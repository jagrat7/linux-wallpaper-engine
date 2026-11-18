import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import type { ActiveWallpapersSchema } from '../store'

// ── Options ────────────────────────────────────────────────────────────────

interface StartBase {
  stdio: StdioOptions
  /**
   * Runs when the backend exits on its own, with the screens it still drove
   * (none for a backend bound to no screen). Skipped once the app is quitting.
   */
  onExit?: (lostScreens: string[]) => void
}

/**
 * Without `screens` the backend is one-off work, such as a compatibility scan.
 * With them it replaces whatever draws there and becomes their `wallpaper`,
 * or their `playlist` when it runs one.
 */
export type StartOptions = StartBase &
  (
    | { screens?: undefined }
    | { screens: string[]; wallpaper: ApplyWallpaperOptions; playlist?: string }
  )

export interface StopOptions {
  /** Screens to stop; every screen when omitted */
  screens?: string[]
  /** Keep the screens' wallpapers recorded, for a backend about to replace theirs */
  keep?: boolean
}

// ── Screen state ───────────────────────────────────────────────────────────

/** What a screen shows and the backend drawing it. */
export interface ScreenRecord {
  /** The wallpaper, or for a playlist its first item */
  options: ApplyWallpaperOptions
  /** The playlist the backend runs, if any */
  playlist?: string
  /** Screens sharing this screen's backend. Saved, so pausing still freezes all of them after a restart */
  group: string[]
  /** Whether the screen should stay frozen; kept across a respawn and saved */
  paused: boolean
  /** Missing for a screen restored from the last run until it is respawned */
  proc?: ChildProcess
}

/** Screen name → its record. */
export type ScreenRecords = Map<string, ScreenRecord>

/** The part of the active-wallpapers store that screen records are saved to. */
export type SavedScreens = Pick<
  ActiveWallpapersSchema,
  'activeWallpapers' | 'activePlaylists' | 'pausedScreens' | 'screenGroups'
>

// ── Results ────────────────────────────────────────────────────────────────

/** A screen left without a backend when the process it shared was stopped. */
export interface RemainingScreen {
  screen: string
  options: ApplyWallpaperOptions
  playlist?: string
  // Whether it was paused, so the respawned process can be frozen again
  paused: boolean
}

export interface StopResult {
  /** Requested screens that had a wallpaper */
  stopped: string[]
  /** Screens that shared a killed backend and still need one */
  remaining: RemainingScreen[]
}

export interface PauseResult {
  /** Screens whose paused state flipped, including those sharing a backend */
  changed: string[]
  /** Screens whose backend could not be signalled */
  failed: string[]
}
