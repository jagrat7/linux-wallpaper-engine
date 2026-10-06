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

  // Catalog only: the same cached scan, without the backend check or active state
  catalog(): Promise<Wallpaper[]>

  // Apply, register external process, or reapply all
  apply(target: ApplyTarget): Promise<MutationResult>

  // Stop one screen or all
  stop(screen?: string | string[]): Promise<MutationResult>

  /**
   * Freeze (SIGSTOP) one screen or all. Works for wallpaper and playlist
   * processes alike, since both run as tracked backend processes.
   */
  pause(screen?: string | string[]): Promise<MutationResult>

  /** Unfreeze (SIGCONT) previously paused screens. */
  resume(screen?: string | string[]): Promise<MutationResult>

  /** Apply a random wallpaper, preferring one that is not already active. */
  applyRandom(screen?: string): Promise<MutationResult & { wallpaperTitle?: string }>

  /** Screen keys with an active wallpaper process. */
  getActiveScreens(): string[]

  /** Screen keys whose wallpaper process is paused. */
  getPausedScreens(): string[]

  // Per-wallpaper override CRUD
  overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void>

  // Debug logs, cache invalidation, cleanup
  diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void>
}
