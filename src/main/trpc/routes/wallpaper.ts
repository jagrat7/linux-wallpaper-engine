import { z } from 'zod'
import { trpc } from '../trpc'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { playlistService } from '../../services/playlists/playlist'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import type { DebugInfo } from '../../services/wallpaper/wallpaper.types'
import { settingsService } from '../../services/settings'
import { compatibilityService } from '../../services/compatibility'
import { parseWindowGeometry } from '../../services/wallpaper/wallpaper.utils'

export const wallpaperRouter = trpc.router({
  // Check if linux-wallpaperengine is installed
  checkBackend: trpc.procedure.query(async () => {
    const { backendInstalled } = await wallpaperService.query()
    return { installed: backendInstalled }
  }),

  // Get all wallpapers
  getWallpapers: trpc.procedure.query(async () => {
    const { wallpapers } = await wallpaperService.query()
    return wallpapers
  }),

  // Invalidate wallpaper cache so the next query triggers a fresh scan
  invalidateCache: trpc.procedure.mutation(async () => {
    await wallpaperService.diagnose({ kind: 'invalidateCache' })
    return { success: true }
  }),

  // Get per-wallpaper setting overrides
  getOverrides: trpc.procedure
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      return wallpaperService.overrides({ op: 'get', wallpaperPath: input.path })
    }),

  // Apply a wallpaper
  setWallpaper: trpc.procedure
    .input(
      z.object({
        backgroundId: z.string(),
        screen: z.string().optional(),
        scaling: z.enum(['default', 'stretch', 'fit', 'fill']).optional(),
        fps: z.number().optional(),
        volume: z.number().min(0).max(100).optional(),
        silent: z.boolean().optional(),
        noAutomute: z.boolean().optional(),
        noAudioProcessing: z.boolean().optional(),
        disableMouse: z.boolean().optional(),
        disableParallax: z.boolean().optional(),
        noFullscreenPause: z.boolean().optional(),
        windowed: z
          .object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const settings = await settingsService.loadSettings()

      const options: ApplyWallpaperOptions = {
        backgroundId: input.backgroundId,
        screen: input.screen,
        scaling: input.scaling ?? settings.defaultScaling,
        fps: input.fps ?? settings.fps,
        volume: input.volume ?? settings.volume,
        silent: input.silent ?? settings.silent,
        noAutomute: input.noAutomute ?? settings.noAutomute,
        noAudioProcessing: input.noAudioProcessing ?? !settings.audioProcessing,
        disableMouse: input.disableMouse ?? settings.disableMouse,
        disableParallax: input.disableParallax ?? settings.disableParallax,
        noFullscreenPause: input.noFullscreenPause ?? !settings.pauseOnFullscreen,
        windowed: settings.windowMode ? parseWindowGeometry(settings.windowGeometry) : input.windowed,
      }

      const result = await wallpaperService.apply({ kind: 'wallpaper', options })
      if (result.success && result.screens) {
        playlistService.clearActivePlaylist(result.screens)
      }
      return result
    }),

  // Stop wallpaper(s)
  stopWalpaper: trpc.procedure
    .input(z.object({ screen: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await wallpaperService.stop(input?.screen)
      if (result.success && result.screens) {
        playlistService.clearActivePlaylist(result.screens)
      }
      return result
    }),

  // Get currently active wallpapers
  getActiveWallpaper: trpc.procedure.query(async () => {
    const { active } = await wallpaperService.query()
    return active
  }),

  // Save per-wallpaper setting overrides
  saveOverrides: trpc.procedure
    .input(
      z.object({
        path: z.string(),
        overrides: z.object({
          volume: z.number().min(0).max(100).optional(),
          audioProcessing: z.boolean().optional(),
          scaling: z.enum(['default', 'stretch', 'fit', 'fill']).optional(),
          disableMouse: z.boolean().optional(),
          disableParallax: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await wallpaperService.overrides({ op: 'save', wallpaperPath: input.path, overrides: input.overrides })
      return { success: true }
    }),

  // Reset per-wallpaper setting overrides
  resetOverrides: trpc.procedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input }) => {
      await wallpaperService.overrides({ op: 'reset', wallpaperPath: input.path })
      return { success: true }
    }),

  // Set wallpaper compatibility status (manual user tag)
  setCompatibility: trpc.procedure
    .input(
      z.object({
        path: z.string(),
        status: z.enum(['unknown', 'broken', 'major', 'minor', 'perfect']),
      }),
    )
    .mutation(({ input }) => {
      compatibilityService.setCompatibility(input.path, input.status)
      return { success: true }
    }),

  // Get compatibility map for all wallpapers
  getCompatibilityMap: trpc.procedure.query(() => {
    return compatibilityService.getCompatibilityMap()
  }),

  // Start bulk compatibility scan
  scanAll: trpc.procedure.mutation(async () => {
    const { wallpapers } = await wallpaperService.query()
    return compatibilityService.scanAll(wallpapers)
  }),

  // Get scan progress (for polling)
  getScanProgress: trpc.procedure.query(() => {
    return compatibilityService.getScanProgress()
  }),

  // Get scan results report (joined with wallpaper titles)
  getScanReport: trpc.procedure.query(async () => {
    const report = compatibilityService.getScanReport()
    const { wallpapers } = await wallpaperService.query()
    const titleMap = new Map(wallpapers.map(w => [w.path, w.title]))
    return report.map(entry => ({
      ...entry,
      title: titleMap.get(entry.path) ?? entry.path.split('/').pop() ?? entry.path,
    }))
  }),

  // Abort running scan
  abortScan: trpc.procedure.mutation(() => {
    compatibilityService.abortScan()
    return { success: true }
  }),

  // Get debug logs for a screen
  getDebugLogs: trpc.procedure
    .input(z.object({ screen: z.string() }))
    .query(async ({ input }) => {
      return wallpaperService.diagnose({ kind: 'getLogs', screen: input.screen }) as Promise<DebugInfo>
    }),

  // Clear debug logs for a screen
  clearDebugLogs: trpc.procedure
    .input(z.object({ screen: z.string() }))
    .mutation(async ({ input }) => {
      await wallpaperService.diagnose({ kind: 'clearLogs', screen: input.screen })
      return { success: true }
    }),

})
