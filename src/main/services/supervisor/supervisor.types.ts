import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import type { ActiveWallpapersSchema } from '../store'

// ── Spawning ───────────────────────────────────────────────────────────────

export interface BackendSpawnOptions {
  stdio: StdioOptions
  /**
   * Runs when the backend exits on its own, with the screens it still drove
   * (none for a backend bound to no screen). Skipped once the app is quitting.
   */
  onExit?: (lostScreens: string[]) => void
}

// ── Screen state ───────────────────────────────────────────────────────────

/** What a screen shows and the backend drawing it. */
export interface ScreenRecord {
  options: ApplyWallpaperOptions
  /** Screens sharing this screen's backend. Saved, so pausing still freezes all of them after a restart */
  group: string[]
  paused: boolean
  /** Missing for a screen restored from the last run until it is respawned */
  proc?: ChildProcess
}

/** Screen name → its record. */
export type ScreenRecords = Map<string, ScreenRecord>

/** The part of the active-wallpapers store that screen records are saved to. */
export type SavedScreens = Pick<
  ActiveWallpapersSchema,
  'activeWallpapers' | 'pausedScreens' | 'screenGroups'
>

// ── Results ────────────────────────────────────────────────────────────────

/** A screen left without a backend when the process it shared was released. */
export interface RemainingScreen {
  screen: string
  options: ApplyWallpaperOptions
  // Whether it was paused, so the respawned process can be frozen again
  paused: boolean
}

export interface ReleaseResult {
  /** Screens that shared a killed backend and still need one */
  remaining: RemainingScreen[]
  /** Requested screens that had a wallpaper */
  released: string[]
}
