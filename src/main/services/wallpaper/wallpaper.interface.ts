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

  // Per-wallpaper override CRUD
  overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void>

  // Debug logs, cache invalidation, cleanup
  diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void>
}
