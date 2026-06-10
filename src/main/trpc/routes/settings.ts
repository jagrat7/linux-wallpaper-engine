import { z } from 'zod'
import { trpc } from '../trpc'
import { settingsService, type AppSettings } from '../../services/settings'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { THEME_OPTIONS, type ThemeOption } from '../../../shared/constants/theme'
import { SCALING_OPTIONS, type ScalingOption } from '../../../shared/constants/display'
import { AGE_RATING_OPTIONS, FILTER_TYPE_OPTIONS, type AgeRating, type WallpaperFilterType } from '../../../shared/constants/wallpaper'
import { COMPATIBILITY_OPTIONS, type CompatibilityStatus } from '../../../shared/constants/compatibility'
import { SORT_OPTIONS, type SortBy, SORT_ORDER_OPTIONS, type SortOrder } from '../../../shared/constants/sort'
import { WORKSHOP_SORT_OPTIONS, type WorkshopSortBy } from '../../../shared/constants/workshop'
import { isFlatpak, setFlatpakBypass } from '../../utils/host'
import { setAutostart } from '../../utils/autostart'

// Keys that affect the wallpaper backend process and require reapply
const BACKEND_KEYS = new Set([
  'fps', 'pauseOnFullscreen', 'volume', 'silent', 'noAutomute',
  'audioProcessing', 'defaultScaling', 'disableMouse', 'disableParallax', 'disableParticles', 'assetsDir',
  'windowMode', 'windowGeometry',
])

const windowGeometrySchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*x[1-9]\d*$/, 'Use widthxheight, for example 800x600')
  .nullable()

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
  disableParticles: z.boolean().optional(),

  // Paths
  assetsDir: z.string().nullable().optional(),

  // App
  theme: z.enum(THEME_OPTIONS.map(o => o.value) as [ThemeOption, ...ThemeOption[]]).optional(),
  launchOnLogin: z.boolean().optional(),
  enableSystemTray: z.boolean().optional(),
  minimizeOnStartup: z.boolean().optional(),
  minimizeOnClose: z.boolean().optional(),
  restoreLastWallpaper: z.boolean().optional(),
  lastWallpaperId: z.string().nullable().optional(),
  lastWallpaperScreen: z.string().nullable().optional(),
  showCompatibilityDot: z.boolean().optional(),
  showStatusBar: z.boolean().optional(),
  dynamicBackground: z.boolean().optional(),
  dismissedScanReminder: z.boolean().optional(),
  dismissedUpdateVersion: z.string().nullable().optional(),

  // Debug & Flatpak
  debugMode: z.boolean().optional(),
  windowMode: z.boolean().optional(),
  windowGeometry: windowGeometrySchema.optional(),
  flatpakBypass: z.boolean().optional(),

  // Persisted filter & sort preferences
  filterType: z.array(z.enum(FILTER_TYPE_OPTIONS.map(o => o.value) as [WallpaperFilterType, ...WallpaperFilterType[]])).optional(),
  filterAgeRating: z.array(z.enum(AGE_RATING_OPTIONS.map(o => o.value) as [AgeRating, ...AgeRating[]])).optional(),
  filterTags: z.array(z.string()).optional(),
  filterResolution: z.array(z.string()).optional(),
  favoriteDiscoverSectionIds: z.array(z.string()).optional(),
  workshopFilterType: z.array(z.enum(FILTER_TYPE_OPTIONS.map(o => o.value) as [WallpaperFilterType, ...WallpaperFilterType[]])).optional(),
  workshopFilterAgeRating: z.array(z.enum(AGE_RATING_OPTIONS.map(o => o.value) as [AgeRating, ...AgeRating[]])).optional(),
  workshopFilterTags: z.array(z.string()).optional(),
  workshopFilterResolution: z.array(z.string()).optional(),
  filterCompatibility: z.array(z.enum(COMPATIBILITY_OPTIONS.map(o => o.value) as [CompatibilityStatus, ...CompatibilityStatus[]])).optional(),
  sortBy: z.enum(SORT_OPTIONS.map(o => o.value) as [SortBy, ...SortBy[]]).optional(),
  sortOrder: z.enum(SORT_ORDER_OPTIONS.map(o => o.value) as [SortOrder, ...SortOrder[]]).optional(),
  workshopSortBy: z.enum(WORKSHOP_SORT_OPTIONS.map(o => o.value) as [WorkshopSortBy, ...WorkshopSortBy[]]).optional(),
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

      // Sync flatpak bypass state to the module
      if (input.flatpakBypass !== undefined) {
        setFlatpakBypass(input.flatpakBypass)
      }

      // Write / delete autostart file on update
      if (input.launchOnLogin !== undefined) {
        setAutostart(input.launchOnLogin)
      }

      // Only reapply wallpapers if backend-relevant settings changed
      const needsReapply = Object.keys(input).some(key => BACKEND_KEYS.has(key))
      if (needsReapply) {
        await wallpaperService.apply({ kind: 'reapply' })
      }

      return updated
    }),

  // Reset to defaults
  reset: trpc.procedure.mutation(async () => {
    const current = await settingsService.loadSettings()
    const reset = await settingsService.resetSettings()

    await settingsService.saveSettings({
      dismissedScanReminder: current.dismissedScanReminder,
      dismissedUpdateVersion: current.dismissedUpdateVersion,
    })

    // Reapply active wallpapers with default settings
    await wallpaperService.apply({ kind: 'reapply' })

    return reset
  }),

  // Get default settings
  defaults: trpc.procedure.query(() => {
    return settingsService.getDefaultSettings()
  }),

  // Check if running inside Flatpak
  isFlatpak: trpc.procedure.query(() => {
    return { isFlatpak: isFlatpak() }
  }),
})
