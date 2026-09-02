import type { CompatibilityStatus } from './compatibility'
import type { ScalingOption } from './display'
import type { SortBy, SortOrder } from './sort'
import type { ThemeOption } from './theme'
import { DEFAULT_WALLPAPER_GRID_DENSITY, type WallpaperGridDensity } from './grid'
import { DEFAULT_FAVORITE_DISCOVER_SECTION_IDS, type WorkshopSortBy } from './workshop'
import type { AgeRating, WallpaperFilterType } from './wallpaper'
import packageJson from '../../../package.json'

export interface AppSettings {
  // Performance settings (backend supported)
  fps: number
  maxRefreshRate: number | null // null means auto-detect
  pauseOnFullscreen: boolean

  // Audio settings (backend supported)
  volume: number
  silent: boolean
  noAutomute: boolean
  audioProcessing: boolean

  // Display settings (backend supported)
  defaultScaling: ScalingOption
  disableMouse: boolean
  disableParallax: boolean
  disableParticles: boolean

  // Paths (backend supported)
  assetsDir: string | null

  // App settings (not backend, managed by our app)
  theme: ThemeOption
  launchOnLogin: boolean
  enableSystemTray: boolean
  minimizeOnStartup: boolean
  minimizeOnClose: boolean
  restoreLastWallpaper: boolean
  lastWallpaperId: string | null
  lastWallpaperScreen: string | null
  showCompatibilityDot: boolean
  showStatusBar: boolean
  dynamicBackground: boolean
  wallpaperGridDensity: WallpaperGridDensity
  dismissedScanReminder: boolean
  dismissedUpdateVersion: string | null

  // Debug & Flatpak
  debugMode: boolean
  windowMode: boolean
  windowGeometry: string | null
  flatpakBypass: boolean

  // Persisted filter & sort preferences
  filterType: WallpaperFilterType[]
  filterAgeRating: AgeRating[]
  filterTags: string[]
  filterResolution: string[]
  favoriteDiscoverSectionIds: string[]
  workshopFilterType: WallpaperFilterType[]
  workshopFilterAgeRating: AgeRating[]
  workshopFilterTags: string[]
  workshopFilterResolution: string[]

  filterCompatibility: CompatibilityStatus[]
  sortBy: SortBy
  sortOrder: SortOrder
  workshopSortBy: WorkshopSortBy
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Performance
  fps: 60,
  maxRefreshRate: null, // Auto-detect from display
  pauseOnFullscreen: true,

  // Audio
  volume: 100,
  silent: false,
  noAutomute: false,
  audioProcessing: true,

  // Display
  defaultScaling: 'fill',
  disableMouse: false,
  disableParallax: false,
  disableParticles: false,

  // Paths
  assetsDir: null,

  // App
  theme: 'system',
  launchOnLogin: false,
  enableSystemTray: false,
  minimizeOnStartup: false,
  minimizeOnClose: false,
  restoreLastWallpaper: true,
  lastWallpaperId: null,
  lastWallpaperScreen: null,
  showCompatibilityDot: true,
  showStatusBar: true,
  dynamicBackground: true,
  wallpaperGridDensity: DEFAULT_WALLPAPER_GRID_DENSITY,
  dismissedScanReminder: false,
  dismissedUpdateVersion: null,

  // Debug & Flatpak
  debugMode: false,
  windowMode: false,
  windowGeometry: null,
  flatpakBypass: false,

  // Filters & sort
  filterType: [],
  filterAgeRating: ['g'],
  filterTags: [],
  filterResolution: [],
  favoriteDiscoverSectionIds: DEFAULT_FAVORITE_DISCOVER_SECTION_IDS,
  workshopFilterType: [],
  workshopFilterAgeRating: [],
  workshopFilterTags: [],
  workshopFilterResolution: [],
  filterCompatibility: [],
  sortBy: 'name',
  sortOrder: 'asc',
  workshopSortBy: 'trend',
}

// App info
export const APP_NAME = 'Linux Wallpaper Engine'
export const APP_VERSION = packageJson.version
export const WALLPAPER_ENGINE_APP_ID = 431960
export const GITHUB_REPO = 'jagrat7/linux-wallpaper-engine'

export const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const STEAM_ROOT_PATHS = [
  '~/.local/share/Steam',
  '~/.steam/steam',
  '~/.var/app/com.valvesoftware.Steam/.local/share/Steam',
  '~/.var/app/com.valvesoftware.Steam/.data/Steam',
  '~/.var/app/com.valvesoftware.Steam/.steam/steam',
]
