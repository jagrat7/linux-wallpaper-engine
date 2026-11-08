import type { Wallpaper, WallpaperOverrides } from '../../../shared/constants/wallpaper'
import type {
  MutationResult,
  ActiveWallpaperEntry,
  ApplyResult,
  DebugInfo,
  OverrideMutation,
  ServiceAction,
  ApplyTarget,
} from './wallpaper.types'

// ── Wallpaper service — what the library holds and what each screen shows ──

export interface IWallpaperService {
  /** Installed wallpapers from one shared, cached library scan, and when each was last applied. */
  catalog(): Promise<{ wallpapers: Wallpaper[]; appliedHistory: Record<string, number> }>

  /**
   * What each screen shows: wallpaper, title, thumbnail, playlist and paused
   * state. Never waits on a library scan, so it answers right after launch.
   */
  getActive(): Promise<ActiveWallpaperEntry[]>

  /** Put something on screens: a wallpaper, a random one or a playlist; or reapply or restore the current ones. */
  apply(target: ApplyTarget): Promise<ApplyResult>

  /** Stop one screen, several, or all of them. Playlists stop the same way. */
  stop(screen?: string | string[]): Promise<MutationResult>

  /** Freeze (SIGSTOP) or resume (SIGCONT) one screen, several, or all of them. */
  setPaused(paused: boolean, screen?: string | string[]): Promise<MutationResult>

  /** Read, save or reset one wallpaper's overrides. */
  overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void>

  /** Debug logs, cache invalidation and cleanup. */
  diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void>
}
