import type { ApplyWallpaperOptions, WallpaperOverrides } from '../../../shared/constants/wallpaper'

// ── Result types ───────────────────────────────────────────────────────────

export interface MutationResult {
  success: boolean
  error?: string
  screens?: string[]
}

export interface ActiveWallpaperEntry {
  screen: string
  wallpaper: ApplyWallpaperOptions
  title: string
  thumbnail: string
  // The playlist the screen runs, if any
  playlist?: string
  // Whether the screen's process is currently frozen (paused)
  paused: boolean
}

export interface DebugInfo {
  command: string
  logs: string[]
}

// ── Overrides mutation ─────────────────────────────────────────────────────

export type OverrideMutation =
  | { op: 'get'; wallpaperPath: string }
  | { op: 'save'; wallpaperPath: string; overrides: WallpaperOverrides }
  | { op: 'reset'; wallpaperPath: string }

// ── Service  action ─────────────────────────────────────────────────────────

export type ServiceAction =
  | { kind: 'getLogs'; screen: string }
  | { kind: 'clearLogs'; screen: string }
  | { kind: 'invalidateCache' }
  | { kind: 'cleanup' }

// ── Apply target ───────────────────────────────────────────────────────────

export type ApplyTarget =
  /** A wallpaper; options left out are filled from settings */
  | { kind: 'wallpaper'; options: Partial<ApplyWallpaperOptions> & { backgroundId: string } }
  /** An installed wallpaper not already showing, when there is one */
  | { kind: 'random'; screen?: string }
  /** A playlist, replacing whatever the screens were running */
  | { kind: 'playlist'; name: string; screens: string[]; stampLastApplied: boolean }
  /** Respawn every screen with the current settings */
  | { kind: 'reapply' }
  /** Bring back the last run's wallpapers; once, at launch */
  | { kind: 'restore' }

export type ApplyResult = MutationResult & {
  /** The wallpaper a random apply picked */
  wallpaperTitle?: string
}
