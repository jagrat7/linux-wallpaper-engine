import { z } from 'zod'
import { trpc } from '../trpc'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { type ApplyWallpaperOptions } from '../../../shared/constants'
import { settingsService } from '../../services/settings'
import { CompatibilityService } from '../../services/compatibility'

export const wallpaperRouter = trpc.router({
  // Check if linux-wallpaperengine is installed
  checkBackend: trpc.procedure.query(async () => {
    return { installed: await wallpaperService.checkBackendInstalled() }
  }),

  // Get all wallpapers
  getWallpapers: trpc.procedure
    .input(
      z.object({
        search: z.string().optional(),
        refresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      return wallpaperService.getWallpapers(input)
    }),

  // Get per-wallpaper setting overrides
  getOverrides: trpc.procedure
    .input(z.object({ path: z.string() }))
    .query(({ input }) => {
      return wallpaperService.getWallpaperOverrides(input.path)
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
      // Load saved settings and merge with input (input takes priority)
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
        windowed: input.windowed,
      }

      return wallpaperService.applyWallpaper(options)
    }),

  // Stop wallpaper(s)
  stopWalpaper: trpc.procedure
    .input(z.object({ screen: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      return wallpaperService.stopWallpaper(input?.screen)
    }),

  // Take a screenshot of a wallpaper
  screenshot: trpc.procedure
    .input(
      z.object({
        backgroundPath: z.string(),
        outputPath: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return wallpaperService.takeScreenshot(input.backgroundPath, input.outputPath)
    }),

  // Get currently active wallpapers
  getActiveWallpaper: trpc.procedure.query(async () => {
    return wallpaperService.getActiveWallpapersWithTitles()
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
      await wallpaperService.saveWallpaperOverrides(input.path, input.overrides)
      return { success: true }
    }),

  // Reset per-wallpaper setting overrides
  resetOverrides: trpc.procedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input }) => {
      await wallpaperService.resetWallpaperOverrides(input.path)
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
      CompatibilityService.getInstance().setCompatibility(input.path, input.status)
      return { success: true }
    }),

  // Get compatibility map for all wallpapers
  getCompatibilityMap: trpc.procedure.query(() => {
    return CompatibilityService.getInstance().getCompatibilityMap()
  }),

  // Start bulk compatibility scan
  scanAll: trpc.procedure.mutation(async () => {
    const wallpapers = await wallpaperService.getWallpapers()
    return CompatibilityService.getInstance().scanAll(wallpapers)
  }),

  // Get scan progress (for polling)
  getScanProgress: trpc.procedure.query(() => {
    return CompatibilityService.getInstance().getScanProgress()
  }),

  // Get scan results report (joined with wallpaper titles)
  getScanReport: trpc.procedure.query(async () => {
    const report = CompatibilityService.getInstance().getScanReport()
    const wallpapers = await wallpaperService.getWallpapers()
    const titleMap = new Map(wallpapers.map(w => [w.path, w.title]))
    return report.map(entry => ({
      ...entry,
      title: titleMap.get(entry.path) ?? entry.path.split('/').pop() ?? entry.path,
    }))
  }),

  // Abort running scan
  abortScan: trpc.procedure.mutation(() => {
    CompatibilityService.getInstance().abortScan()
    return { success: true }
  }),

})
