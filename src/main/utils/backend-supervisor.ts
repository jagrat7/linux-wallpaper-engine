import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../shared/constants/wallpaper'
import { storeService } from '../services/store'
import { hostExecFileAsync, hostExecFileSync, hostSpawn, shouldUseFlatpakSpawn } from './host'

interface BackendSpawnOptions {
  stdio: StdioOptions
  /**
   * Runs when the backend exits on its own, with the screens it still drove
   * (none for a backend bound to no screen). Skipped once the app is quitting.
   */
  onExit?: (lostScreens: string[]) => void
}

/** A screen left without a backend when the process it shared was released. */
export interface RemainingScreen {
  screen: string
  options: ApplyWallpaperOptions
  // Whether it was paused, so the respawned process can be frozen again
  paused: boolean
}

/** What a screen shows and the backend drawing it. */
interface ScreenRecord {
  options: ApplyWallpaperOptions
  /** Screens sharing this screen's backend. Saved, so pausing still freezes all of them after a restart */
  group: string[]
  paused: boolean
  /** Missing for a screen restored from the last run until it is respawned */
  proc?: ChildProcess
}

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
class BackendSupervisor {
  // Every backend still running, including compatibility scans and released ones not yet exited
  private live = new Set<ChildProcess>()
  private screens = new Map<string, ScreenRecord>()
  private store = storeService.activeWallpapers
  private queue: Promise<unknown> = Promise.resolve()
  private stopping = false
  private pending = 0

  constructor() {
    this.load()
  }

  // ── Queue ──────────────────────────────────────────────────────────────

  /** Run `task` once every task queued before it has settled. */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++
    const result = this.queue.then(task).finally(() => {
      this.pending--
    })
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Whether no task is running or waiting in `run`. */
  get isIdle(): boolean {
    return this.pending === 0
  }

  /** Whether the app is quitting: new backends are refused and exits are expected. */
  get isShuttingDown(): boolean {
    return this.stopping
  }

  // ── Processes ──────────────────────────────────────────────────────────

  /** Spawn a backend bound to no screen, such as a compatibility scan. Throws once the app is quitting. */
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

  /**
   * Spawn a backend that draws on `screens` and record it as their wallpaper.
   * Detach or release whatever drove them first: an old backend is not killed here.
   */
  spawnFor(
    screens: string[],
    options: ApplyWallpaperOptions,
    args: string[],
    spawnOptions: BackendSpawnOptions,
  ): ChildProcess {
    const proc = this.spawn(args, spawnOptions)
    for (const screen of screens) {
      this.leaveGroup(screen)
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

  /**
   * Kill one backend. Under Flatpak the handle is flatpak-spawn, which forwards
   * SIGTERM to the host backend but would die alone on SIGKILL.
   */
  kill(proc: ChildProcess): void {
    try {
      proc.kill(shouldUseFlatpakSpawn() ? 'SIGTERM' : 'SIGKILL')
    } catch {
      /* already dead */
    }
  }

  /**
   * Kill every backend whose command line matches one of `patterns`. Reaches
   * backends this instance holds no handle for (left by a crashed run) and the
   * host backend behind a Flatpak handle. A pattern with no match is fine.
   */
  async killMatching(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await hostExecFileAsync('pkill', ['-9', '-f', pattern]).catch(() => undefined)
    }
  }

  /**
   * Kill the backends drawing on `screens` but keep the screens' wallpapers, so
   * they can be respawned in place. Unlike `release`, the screens never drop out
   * of the saved state, and the old backends exiting reports no lost screens.
   */
  detach(screens: string[]): void {
    const procs = new Set(screens.flatMap((screen) => this.screens.get(screen)?.proc ?? []))
    for (const record of this.screens.values()) {
      if (record.proc && procs.has(record.proc)) delete record.proc
    }
    for (const proc of procs) this.kill(proc)
  }

  /**
   * Stop the wallpaper on `screens`, killing the backends behind them. Screens
   * that shared one of those backends keep their wallpaper but lose the process,
   * so they are returned in `remaining` for the caller to respawn.
   */
  release(screens: string[]): { remaining: RemainingScreen[]; released: string[] } {
    const targets = new Set(screens)
    const released = [...targets].filter((screen) => this.screens.has(screen))
    const procs = new Set(released.flatMap((screen) => this.screens.get(screen)?.proc ?? []))
    const remaining: RemainingScreen[] = []

    for (const proc of procs) {
      for (const [screen, record] of this.screens) {
        if (record.proc !== proc || targets.has(screen)) continue
        remaining.push({ screen, options: record.options, paused: record.paused })
        this.screens.set(screen, { options: record.options, group: [screen], paused: false })
      }
      this.kill(proc)
    }
    for (const screen of targets) this.screens.delete(screen)
    if (released.length > 0) this.save()

    return { remaining, released }
  }

  /** Stop every screen's wallpaper and kill their backends. */
  reset(): void {
    const procs = new Set([...this.screens.values()].flatMap((record) => record.proc ?? []))
    for (const proc of procs) this.kill(proc)
    this.screens.clear()
    this.save()
  }

  /**
   * Kill every backend and refuse new ones, keeping the saved wallpapers for the
   * next launch. Synchronous, so it finishes inside Electron's quit sequence:
   * pausing that sequence for async work leaves a signal-driven quit hanging.
   *
   * @param hostPatterns Also killed by command line under Flatpak, where a
   *   handle only reaches flatpak-spawn and not the host backend behind it
   */
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

  /** Each screen with a wallpaper, and that wallpaper's options. */
  getActive(): ReadonlyMap<string, ApplyWallpaperOptions> {
    return new Map([...this.screens].map(([screen, record]) => [screen, record.options]))
  }

  /** The backend drawing on `screen`; undefined for a restored screen not yet respawned. */
  getProcess(screen: string): ChildProcess | undefined {
    return this.screens.get(screen)?.proc
  }

  /** Whether `backgroundId` is on a screen while at least one backend is running. */
  isActive(backgroundId: string): boolean {
    const records = [...this.screens.values()]
    if (!records.some((record) => record.proc)) return false
    return records.some((record) => record.options.backgroundId === backgroundId)
  }

  /** Screens whose backend process is currently frozen with SIGSTOP. */
  getPausedScreens(): string[] {
    return [...this.screens].filter(([, record]) => record.paused).map(([screen]) => screen)
  }

  /** Whether `screen`'s backend process is currently frozen. */
  isPaused(screen: string): boolean {
    return this.screens.get(screen)?.paused ?? false
  }

  /**
   * Mark screens as paused/unpaused. Screens sharing a process freeze and
   * unfreeze together, so the mark expands to each screen's whole group.
   */
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
    const lost = [...this.screens].filter(([, record]) => record.proc === proc).map(([s]) => s)
    for (const screen of lost) this.screens.delete(screen)
    if (lost.length > 0) this.save()
    return lost
  }

  // A screen moving to a new backend leaves its old group, so pausing a former
  // sibling no longer marks it paused
  private leaveGroup(screen: string): void {
    for (const sibling of this.screens.get(screen)?.group ?? []) {
      const record = this.screens.get(sibling)
      if (sibling === screen || !record?.group.includes(screen)) continue
      record.group = record.group.filter((member) => member !== screen)
    }
  }

  private load(): void {
    const paused = new Set(this.store.get('pausedScreens') ?? [])
    const groups = this.store.get('screenGroups') ?? {}
    for (const [screen, options] of Object.entries(this.store.get('activeWallpapers'))) {
      this.screens.set(screen, {
        options,
        group: groups[screen] ?? [screen],
        paused: paused.has(screen),
      })
    }
  }

  private save(): void {
    const active: Record<string, ApplyWallpaperOptions> = {}
    const groups: Record<string, string[]> = {}
    for (const [screen, record] of this.screens) {
      active[screen] = record.options
      groups[screen] = record.group
    }
    this.store.set('activeWallpapers', active)
    this.store.set('pausedScreens', this.getPausedScreens())
    this.store.set('screenGroups', groups)
  }
}

export const backendSupervisor = new BackendSupervisor()
