import type { ChildProcess } from 'node:child_process'
import type {
  PauseResult,
  ScreenRecord,
  StartOptions,
  StopOptions,
  StopResult,
} from './supervisor.types'

// ── Supervisor — owns every backend process and each screen's wallpaper ────

export interface ISupervisorService {
  /** Run `task` once every task queued before it has settled, so kill → spawn sequences never interleave. */
  run<T>(task: () => Promise<T>): Promise<T>
  /** No task is running or waiting in `run`. */
  readonly idle: boolean

  /**
   * Start a backend. With `screens`, first stop whatever draws there (including
   * a backend a crashed run left behind), then record the new one as their
   * wallpaper. A paused screen stays marked paused; `setPaused` freezes the new
   * backend. Rejects once the app is quitting.
   */
  start(args: string[], options: StartOptions): Promise<ChildProcess>

  /**
   * Stop screens (every screen by default): kill their tracked backends and any
   * untracked one on the same screen. Screens that shared a killed backend keep
   * their wallpaper and come back in `remaining` for the caller to respawn.
   */
  stop(options?: StopOptions): Promise<StopResult>

  /**
   * Freeze (SIGSTOP) or resume (SIGCONT) the backends of `screens`. Screens
   * sharing a backend flip together. Also freezes a respawned backend whose
   * screen is still marked paused.
   */
  setPaused(screens: string[], paused: boolean): Promise<PauseResult>

  /** Forget screens with no backend handle whose backend is no longer running. Returns them. */
  prune(): Promise<string[]>

  /** Kill one backend from `start`, such as a finished compatibility scan. */
  kill(proc: ChildProcess): void

  /**
   * Kill every backend and refuse new ones, keeping the saved wallpapers for the
   * next launch. Synchronous, so it finishes inside Electron's quit sequence:
   * pausing that sequence for async work leaves a signal-driven quit hanging.
   */
  shutdown(): void

  /** Each screen with a wallpaper: its options, paused mark and backend. */
  screens(): ReadonlyMap<string, Readonly<ScreenRecord>>
}
