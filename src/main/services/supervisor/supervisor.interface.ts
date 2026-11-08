import type { ChildProcess } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import type { BackendSpawnOptions, ReleaseResult } from './supervisor.types'

// ── Supervisor — owns every backend process and each screen's wallpaper ────

export interface ISupervisorService {
  // Queue
  /** Run `task` once every task queued before it has settled. */
  run<T>(task: () => Promise<T>): Promise<T>
  /** Whether no task is running or waiting in `run`. */
  readonly isIdle: boolean
  /** Whether the app is quitting: new backends are refused and exits are expected. */
  readonly isShuttingDown: boolean

  // Processes
  /** Spawn a backend bound to no screen, such as a compatibility scan. Throws once the app is quitting. */
  spawn(args: string[], options: BackendSpawnOptions): ChildProcess

  /**
   * Spawn a backend that draws on `screens` and record it as their wallpaper.
   * Detach or release whatever drove them first: an old backend is not killed here.
   */
  spawnFor(
    screens: string[],
    options: ApplyWallpaperOptions,
    args: string[],
    spawnOptions: BackendSpawnOptions,
  ): ChildProcess

  /**
   * Kill one backend. Under Flatpak the handle is flatpak-spawn, which forwards
   * SIGTERM to the host backend but would die alone on SIGKILL.
   */
  kill(proc: ChildProcess): void

  /**
   * Kill every backend whose command line matches one of `patterns`. Reaches
   * backends this instance holds no handle for (left by a crashed run) and the
   * host backend behind a Flatpak handle. A pattern with no match is fine.
   */
  killMatching(patterns: string[]): Promise<void>

  /**
   * Kill the backends drawing on `screens` but keep the screens' wallpapers, so
   * they can be respawned in place. Unlike `release`, the screens never drop out
   * of the saved state, and the old backends exiting reports no lost screens.
   */
  detach(screens: string[]): void

  /**
   * Stop the wallpaper on `screens`, killing the backends behind them. Screens
   * that shared one of those backends keep their wallpaper but lose the process,
   * so they are returned in `remaining` for the caller to respawn.
   */
  release(screens: string[]): ReleaseResult

  /** Stop every screen's wallpaper and kill their backends. */
  reset(): void

  /**
   * Kill every backend and refuse new ones, keeping the saved wallpapers for the
   * next launch. Synchronous, so it finishes inside Electron's quit sequence:
   * pausing that sequence for async work leaves a signal-driven quit hanging.
   *
   * @param hostPatterns Also killed by command line under Flatpak, where a
   *   handle only reaches flatpak-spawn and not the host backend behind it
   */
  shutdown(hostPatterns?: string[]): void

  // Screens
  /** Each screen with a wallpaper, and that wallpaper's options. */
  getActive(): ReadonlyMap<string, ApplyWallpaperOptions>
  /** The backend drawing on `screen`; undefined for a restored screen not yet respawned. */
  getProcess(screen: string): ChildProcess | undefined
  /** Whether `backgroundId` is on a screen while at least one backend is running. */
  isActive(backgroundId: string): boolean
  /** Screens whose backend process is currently frozen with SIGSTOP. */
  getPausedScreens(): string[]
  /** Whether `screen`'s backend process is currently frozen. */
  isPaused(screen: string): boolean
  /**
   * Mark screens as paused/unpaused. Screens sharing a process freeze and
   * unfreeze together, so the mark expands to each screen's whole group.
   */
  markPaused(screens: string[], paused: boolean): void
}
