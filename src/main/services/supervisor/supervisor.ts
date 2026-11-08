import type { ChildProcess } from 'node:child_process'
export type { RemainingScreen } from './supervisor.types'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import { storeService } from '../store'
import {
  hostExecFileAsync,
  hostExecFileSync,
  hostSpawn,
  shouldUseFlatpakSpawn,
} from '../../utils/host'
import type { ISupervisorService } from './supervisor.interface'
import type {
  BackendSpawnOptions,
  ReleaseResult,
  RemainingScreen,
  ScreenRecords,
} from './supervisor.types'
import {
  killSignal,
  leaveGroup,
  processesOf,
  recordsFromSaved,
  screensDrivenBy,
  toSavedScreens,
} from './supervisor.utils'

/**
 * Sole owner of the linux-wallpaperengine processes this app instance starts,
 * and of which wallpaper each screen shows.
 *
 * Every backend (wallpapers, playlists and compatibility scans) is spawned and
 * killed here, so quitting can take all of them down. A backend started for
 * screens is recorded against them and saved, so the next launch can restore
 * them. Process work that kills and respawns backends runs through `run`, one
 * task at a time, so two callers can never interleave their kill → spawn
 * sequences on the same screen.
 */
class SupervisorService implements ISupervisorService {
  private static instance: SupervisorService | null = null

  // Every backend still running, including compatibility scans and released ones not yet exited
  private live = new Set<ChildProcess>()
  private screens: ScreenRecords
  private store = storeService.activeWallpapers
  private queue: Promise<unknown> = Promise.resolve()
  private stopping = false
  private pending = 0

  private constructor() {
    this.screens = recordsFromSaved({
      activeWallpapers: this.store.get('activeWallpapers'),
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

  get isIdle(): boolean {
    return this.pending === 0
  }

  get isShuttingDown(): boolean {
    return this.stopping
  }

  // ── Processes ──────────────────────────────────────────────────────────

  spawn(args: string[], { stdio, onExit }: BackendSpawnOptions): ChildProcess {
    if (this.stopping) throw new Error('The app is quitting')

    const proc = hostSpawn('linux-wallpaperengine', args, { detached: true, stdio })
    // Quit kills backends explicitly, so the event loop never has to wait on them
    proc.unref()
    this.live.add(proc)
    proc.once('exit', () => {
      this.live.delete(proc)
      // Saved screens must outlive a quit, so exits during one change nothing
      if (this.stopping) return
      onExit?.(this.forget(proc))
    })
    return proc
  }

  spawnFor(
    screens: string[],
    options: ApplyWallpaperOptions,
    args: string[],
    spawnOptions: BackendSpawnOptions,
  ): ChildProcess {
    const proc = this.spawn(args, spawnOptions)
    for (const screen of screens) {
      leaveGroup(this.screens, screen)
      this.screens.set(screen, {
        options: { ...options, screen },
        group: screens,
        paused: false,
        proc,
      })
    }
    this.save()
    return proc
  }

  kill(proc: ChildProcess): void {
    try {
      proc.kill(killSignal(shouldUseFlatpakSpawn()))
    } catch {
      /* already dead */
    }
  }

  async killMatching(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await hostExecFileAsync('pkill', ['-9', '-f', pattern]).catch(() => undefined)
    }
  }

  detach(screens: string[]): void {
    const procs = processesOf(this.screens, screens)
    for (const record of this.screens.values()) {
      if (record.proc && procs.has(record.proc)) delete record.proc
    }
    for (const proc of procs) this.kill(proc)
  }

  release(screens: string[]): ReleaseResult {
    const targets = new Set(screens)
    const released = [...targets].filter((screen) => this.screens.has(screen))
    const remaining: RemainingScreen[] = []

    for (const proc of processesOf(this.screens, released)) {
      for (const [screen, { options, paused, proc: drivenBy }] of this.screens) {
        if (drivenBy !== proc || targets.has(screen)) continue
        remaining.push({ screen, options, paused })
        // Keeps its wallpaper but has no backend until the caller respawns it
        this.screens.set(screen, { options, group: [screen], paused: false })
      }
      this.kill(proc)
    }
    for (const screen of targets) this.screens.delete(screen)
    if (released.length > 0) this.save()

    return { remaining, released }
  }

  reset(): void {
    for (const proc of processesOf(this.screens, this.screens.keys())) this.kill(proc)
    this.screens.clear()
    this.save()
  }

  shutdown(hostPatterns: string[] = []): void {
    this.stopping = true
    for (const proc of this.live) this.kill(proc)
    this.live.clear()
    if (!shouldUseFlatpakSpawn()) return
    for (const pattern of hostPatterns) {
      hostExecFileSync('pkill', ['-9', '-f', pattern])
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────

  getActive(): ReadonlyMap<string, ApplyWallpaperOptions> {
    return new Map([...this.screens].map(([screen, record]) => [screen, record.options]))
  }

  getProcess(screen: string): ChildProcess | undefined {
    return this.screens.get(screen)?.proc
  }

  isActive(backgroundId: string): boolean {
    const records = [...this.screens.values()]
    if (!records.some((record) => record.proc)) return false
    return records.some((record) => record.options.backgroundId === backgroundId)
  }

  getPausedScreens(): string[] {
    return [...this.screens].filter(([, record]) => record.paused).map(([screen]) => screen)
  }

  isPaused(screen: string): boolean {
    return this.screens.get(screen)?.paused ?? false
  }

  markPaused(screens: string[], paused: boolean): void {
    for (const screen of screens) {
      for (const member of this.screens.get(screen)?.group ?? [screen]) {
        const record = this.screens.get(member)
        if (record) record.paused = paused
      }
    }
    this.save()
  }

  // ── Private ────────────────────────────────────────────────────────────

  // Drop the screens `proc` still drives, returning them. Screens a newer
  // backend has taken over are no longer `proc`'s and keep their state
  private forget(proc: ChildProcess): string[] {
    const lost = screensDrivenBy(this.screens, proc)
    for (const screen of lost) this.screens.delete(screen)
    if (lost.length > 0) this.save()
    return lost
  }

  private save(): void {
    const saved = toSavedScreens(this.screens)
    this.store.set('activeWallpapers', saved.activeWallpapers)
    this.store.set('pausedScreens', saved.pausedScreens)
    this.store.set('screenGroups', saved.screenGroups)
  }
}

export const supervisorService = SupervisorService.getInstance()
