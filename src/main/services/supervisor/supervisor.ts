import type { ChildProcess } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
export type { RemainingScreen, ScreenRecord } from './supervisor.types'
import { storeService } from '../store'
import {
  hostExecFileAsync,
  hostExecFileSync,
  hostSpawn,
  shouldUseFlatpakSpawn,
} from '../../utils/host'
import type { ISupervisorService } from './supervisor.interface'
import type {
  PauseResult,
  RemainingScreen,
  ScreenRecord,
  ScreenRecords,
  StartOptions,
  StopOptions,
  StopResult,
} from './supervisor.types'
import {
  killSignal,
  leaveGroup,
  listBackendProcesses,
  processesOf,
  recordsFromSaved,
  screenPattern,
  screensDrivenBy,
  signalBackend,
  toSavedScreens,
} from './supervisor.utils'

// How long a replaced backend gets to let go of its screen before the new one starts
const REPLACE_GRACE_MS = 100

/**
 * Sole owner of the linux-wallpaperengine processes this app instance starts,
 * and of what each screen shows.
 *
 * Every backend (wallpapers, playlists and compatibility scans) is started,
 * paused and stopped here, so quitting can take all of them down and the saved
 * state always matches the processes. A backend started for screens is
 * recorded against them and saved, so the next launch can restore them.
 * Callers put kill → spawn work through `run`, one task at a time, so two
 * callers never interleave on the same screen.
 */
class SupervisorService implements ISupervisorService {
  private static instance: SupervisorService | null = null

  // Every backend still running, including compatibility scans and stopped ones not yet exited
  private live = new Set<ChildProcess>()
  // Backends currently held with SIGSTOP
  private frozen = new WeakSet<ChildProcess>()
  private records: ScreenRecords
  private store = storeService.activeWallpapers
  private queue: Promise<unknown> = Promise.resolve()
  private stopping = false
  private pending = 0

  private constructor() {
    // Older versions saved a single playlist under `activePlaylist`
    const legacy = this.store.get('activePlaylist')
    this.records = recordsFromSaved({
      activeWallpapers: this.store.get('activeWallpapers'),
      activePlaylists: {
        ...(legacy && { [legacy.screen]: legacy }),
        ...this.store.get('activePlaylists'),
      },
      pausedScreens: this.store.get('pausedScreens'),
      screenGroups: this.store.get('screenGroups'),
    })
  }

  static getInstance(): SupervisorService {
    if (!SupervisorService.instance) {
      SupervisorService.instance = new SupervisorService()
    }
    return SupervisorService.instance
  }

  // ── Queue ──────────────────────────────────────────────────────────────

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++
    const result = this.queue.then(task).finally(() => {
      this.pending--
    })
    this.queue = result.catch(() => undefined)
    return result
  }

  get idle(): boolean {
    return this.pending === 0
  }

  // ── Backends ───────────────────────────────────────────────────────────

  async start(args: string[], options: StartOptions): Promise<ChildProcess> {
    this.assertRunning()
    if (options.screens) {
      await this.stop({ screens: options.screens, keep: true })
      await sleep(REPLACE_GRACE_MS)
      this.assertRunning()
    }

    const proc = hostSpawn('linux-wallpaperengine', args, {
      detached: true,
      stdio: options.stdio,
    })
    // Quit kills backends explicitly, so the event loop never has to wait on them
    proc.unref()
    this.live.add(proc)
    proc.once('exit', () => {
      this.live.delete(proc)
      // Saved screens must outlive a quit, so exits during one change nothing
      if (this.stopping) return
      // Forget first: an optional call would skip evaluating its argument
      const lost = this.forget(proc)
      options.onExit?.(lost)
    })

    if (options.screens) {
      const { screens, wallpaper, playlist } = options
      for (const screen of screens) {
        const paused = this.records.get(screen)?.paused ?? false
        leaveGroup(this.records, screen)
        this.records.set(screen, {
          options: { ...wallpaper, screen },
          ...(playlist && { playlist }),
          group: screens,
          paused,
          proc,
        })
      }
      this.save()
    }
    return proc
  }

  async stop({ screens, keep = false }: StopOptions = {}): Promise<StopResult> {
    const targets = new Set(screens ?? this.records.keys())
    // Read before the records change: the window-mode screen is found through its record
    const patterns = [...targets].flatMap((screen) => this.patternFor(screen) ?? [])
    const stopped = [...targets].filter((screen) => this.records.has(screen))
    const remaining: RemainingScreen[] = []

    for (const proc of processesOf(this.records, targets)) {
      for (const [screen, record] of this.records) {
        if (record.proc !== proc) continue
        if (targets.has(screen)) {
          delete record.proc
          continue
        }
        // Keeps its wallpaper but has no backend until the caller respawns it
        const { options, playlist, paused } = record
        remaining.push({ screen, options, ...(playlist && { playlist }), paused })
        this.records.set(screen, {
          options,
          ...(playlist && { playlist }),
          group: [screen],
          paused,
        })
      }
      this.kill(proc)
    }
    if (!keep) for (const screen of targets) this.records.delete(screen)
    if (stopped.length > 0) this.save()

    // Also reaches a backend with no handle: a crashed run's, or the host side under Flatpak
    await this.killMatching(patterns)
    return { stopped, remaining }
  }

  async setPaused(screens: string[], paused: boolean): Promise<PauseResult> {
    const changed: string[] = []
    const failed: string[] = []
    for (const screen of screens) {
      const record = this.records.get(screen)
      if (!record) continue
      const frozen = record.proc ? this.frozen.has(record.proc) : false
      if (record.paused === paused && frozen === paused) continue

      const signal = paused ? 'SIGSTOP' : 'SIGCONT'
      if (!(await signalBackend(signal, record.proc, this.patternFor(screen)))) {
        failed.push(screen)
        continue
      }
      if (record.proc) {
        if (paused) this.frozen.add(record.proc)
        else this.frozen.delete(record.proc)
      }
      // Screens sharing the backend froze or resumed with it
      for (const member of record.group) {
        const sibling = this.records.get(member)
        if (!sibling || sibling.paused === paused) continue
        sibling.paused = paused
        changed.push(member)
      }
    }
    if (changed.length > 0) this.save()
    return { changed, failed }
  }

  async prune(): Promise<string[]> {
    const unowned = [...this.records].filter(([, record]) => !record.proc).map(([screen]) => screen)
    if (unowned.length === 0) return []

    const running = await listBackendProcesses()
    const dead = unowned.filter((screen) => {
      const pattern = this.patternFor(screen)
      return !pattern || !running.some((line) => new RegExp(pattern).test(line))
    })
    for (const screen of dead) this.records.delete(screen)
    if (dead.length > 0) this.save()
    return dead
  }

  kill(proc: ChildProcess): void {
    try {
      // A frozen process holds SIGTERM until it is resumed
      if (this.frozen.has(proc)) proc.kill('SIGCONT')
      proc.kill(killSignal(shouldUseFlatpakSpawn()))
    } catch {
      /* already dead */
    }
  }

  shutdown(): void {
    this.stopping = true
    for (const proc of this.live) this.kill(proc)
    this.live.clear()
    // Under Flatpak a handle only reaches flatpak-spawn, so also kill the host backends
    if (!shouldUseFlatpakSpawn()) return
    for (const screen of this.records.keys()) {
      const pattern = this.patternFor(screen)
      if (pattern) hostExecFileSync('pkill', ['-9', '-f', pattern])
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────

  screens(): ReadonlyMap<string, Readonly<ScreenRecord>> {
    return this.records
  }

  // ── Private ────────────────────────────────────────────────────────────

  private assertRunning(): void {
    if (this.stopping) throw new Error('The app is quitting')
  }

  // How to find `screen`'s backend by command line, for one this instance has no handle for
  private patternFor(screen: string): string | null {
    const record = this.records.get(screen)
    return screenPattern(screen, {
      playlist: record?.playlist,
      backgroundId: record?.options.backgroundId,
    })
  }

  // pkill -9 by command line; a pattern with no match is fine
  private async killMatching(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await hostExecFileAsync('pkill', ['-9', '-f', pattern]).catch(() => undefined)
    }
  }

  // Drop the screens `proc` still drives, returning them. Screens a newer
  // backend has taken over are no longer `proc`'s and keep their state
  private forget(proc: ChildProcess): string[] {
    const lost = screensDrivenBy(this.records, proc)
    for (const screen of lost) this.records.delete(screen)
    if (lost.length > 0) this.save()
    return lost
  }

  private save(): void {
    const saved = toSavedScreens(this.records)
    this.store.set('activeWallpapers', saved.activeWallpapers)
    this.store.set('activePlaylists', saved.activePlaylists)
    this.store.set('activePlaylist', null)
    this.store.set('pausedScreens', saved.pausedScreens)
    this.store.set('screenGroups', saved.screenGroups)
  }
}

export const supervisorService = SupervisorService.getInstance()
