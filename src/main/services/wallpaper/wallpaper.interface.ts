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
  /** Installed wallpapers and when each was last applied, for the library grid. */
  query(): Promise<{
    wallpapers: Wallpaper[]
    appliedHistory: Record<string, number>
  }>

  /** Installed wallpapers from the same cached scan as `query`. */
  catalog(): Promise<Wallpaper[]>

  /** Wallpapers active on each screen, without waiting on a library scan. */
  getActive(): Promise<ActiveWallpaperEntry[]>

  /** Whether the linux-wallpaperengine backend is on the host PATH. */
  isBackendInstalled(): Promise<boolean>

  /**
   * Bring back the wallpapers saved from the last run, replacing any backends
   * a crashed run left behind. Called once at launch.
   */
  restore(): Promise<MutationResult>

  // Apply a wallpaper or reapply all
  apply(target: ApplyTarget): Promise<MutationResult>

  /** Start a playlist's backend on `screens`, replacing whatever they were running. */
  startPlaylist(
    playlistName: string,
    screens: string[],
    stampLastApplied: boolean,
  ): Promise<{ success: boolean; error?: string }>

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
