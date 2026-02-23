import { z } from 'zod'
import { trpc } from '../trpc'
import { settingsService, type AppSettings } from '../../services/settings'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { THEME_OPTIONS, SCALING_OPTIONS, type ThemeOption, type ScalingOption } from '../../../shared/constants'

// Keys that affect the wallpaper backend process and require reapply
const BACKEND_KEYS = new Set([
  'fps', 'pauseOnFullscreen', 'volume', 'silent', 'noAutomute',
  'audioProcessing', 'defaultScaling', 'disableMouse', 'disableParallax', 'assetsDir',
])

const settingsSchema = z.object({
  // Performance
  fps: z.number().optional(),
  pauseOnFullscreen: z.boolean().optional(),

  // Audio
  volume: z.number().min(0).max(100).optional(),
  silent: z.boolean().optional(),
  noAutomute: z.boolean().optional(),
  audioProcessing: z.boolean().optional(),

  // Display
  defaultScaling: z.enum(SCALING_OPTIONS.map(o => o.value) as [ScalingOption, ...ScalingOption[]]).optional(),
  disableMouse: z.boolean().optional(),
  disableParallax: z.boolean().optional(),

  // Paths
  assetsDir: z.string().nullable().optional(),

  // App
  theme: z.enum(THEME_OPTIONS.map(o => o.value) as [ThemeOption, ...ThemeOption[]]).optional(),
  launchOnLogin: z.boolean().optional(),
  minimizeOnClose: z.boolean().optional(),
  restoreLastWallpaper: z.boolean().optional(),
  lastWallpaperId: z.string().nullable().optional(),
  lastWallpaperScreen: z.string().nullable().optional(),
  showCompatibilityDot: z.boolean().optional(),
  showStatusBar: z.boolean().optional(),
  dynamicBackground: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  dismissedScanReminder: z.boolean().optional(),

  // Persisted filter & sort preferences
  filterType: z.array(z.enum(['all', 'scene', 'video', 'web', 'application'])).optional(),
  filterTags: z.array(z.string()).optional(),
  filterResolution: z.array(z.string()).optional(),
  filterCompatibility: z.array(z.enum(['unknown', 'broken', 'major', 'minor', 'perfect'])).optional(),
  sortBy: z.enum(['name', 'size', 'recent']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const settingsRouter = trpc.router({
  // Get all settings
  get: trpc.procedure.query(async (): Promise<AppSettings> => {
    return settingsService.loadSettings()
  }),

  // Update settings (partial update)
  update: trpc.procedure
    .input(settingsSchema)
    .mutation(async ({ input }) => {
      const updated = await settingsService.saveSettings(input)

      // Only reapply wallpapers if backend-relevant settings changed
      const needsReapply = Object.keys(input).some(key => BACKEND_KEYS.has(key))
      if (needsReapply) {
        await wallpaperService.reapplyActiveWallpapers()
      }

      return updated
    }),

  // Reset to defaults
  reset: trpc.procedure.mutation(async () => {
    const current = await settingsService.loadSettings()
    const reset = await settingsService.resetSettings()

    // Preserve non-resettable flags
    await settingsService.saveSettings({
      onboardingComplete: current.onboardingComplete,
      dismissedScanReminder: current.dismissedScanReminder,
    })

    // Reapply active wallpapers with default settings
    await wallpaperService.reapplyActiveWallpapers()

    return reset
  }),

  // Get default settings
  defaults: trpc.procedure.query(() => {
    return settingsService.getDefaultSettings()
  }),
})
