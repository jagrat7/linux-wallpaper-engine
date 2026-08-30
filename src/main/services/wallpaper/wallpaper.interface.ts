import type { Wallpaper, WallpaperOverrides } from '../../../shared/constants/wallpaper'
import type {
  MutationResult,
  ActiveWallpaperEntry,
  DebugInfo,
  OverrideMutation,
  ServiceAction,
  ApplyTarget,
} from './wallpaper.types'

// ── Main wallpaper service — thin facade with condensed API ────────────────

export interface IWallpaperService {
  // Catalog: scan and check backend
  query(): Promise<{
    wallpapers: Wallpaper[]
    backendInstalled: boolean
    active: ActiveWallpaperEntry[]
  }>

  // Apply, register external process, or reapply all
  apply(target: ApplyTarget): Promise<MutationResult>

  // Stop one screen or all
  stop(screen?: string | string[]): Promise<MutationResult>

  // Freeze (SIGSTOP) one screen or all — works for wallpaper and playlist
  // processes alike, since both run as tracked backend processes
  pause(screen?: string | string[]): Promise<MutationResult>

  // Unfreeze previously paused screens
  resume(screen?: string | string[]): Promise<MutationResult>

  // Apply a random wallpaper to one screen or all
  applyRandom(screen?: string): Promise<MutationResult & { wallpaperTitle?: string }>

  // Snapshot for tray/UI builders: which screens are active and which paused
  getActiveScreens(): string[]
  getPausedScreens(): string[]

  // Per-wallpaper override CRUD
  overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void>

  // Debug logs, cache invalidation, cleanup
  diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void>
}
