import type {
  ApplyWallpaperOptions,
  WallpaperOverrides,
} from '../../../shared/constants/wallpaper'

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
  | { kind: 'wallpaper'; options: ApplyWallpaperOptions }
  | { kind: 'register'; screen?: string; screens?: string[]; proc: import('node:child_process').ChildProcess; args: string[]; options: ApplyWallpaperOptions }
  | { kind: 'reapply' }
