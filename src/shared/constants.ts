// Theme options
export const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Steam', value: 'steam' },
  { label: 'System', value: 'system' },
  { label: 'Hard Light', value: 'hard-light' },
] as const
export type ThemeOption = typeof THEME_OPTIONS[number]['value']

// Scaling options for display
export const SCALING_OPTIONS = [
  { label: 'Default', value: 'default' },
  { label: 'Fill', value: 'fill' },
  { label: 'Fit', value: 'fit' },
  { label: 'Stretch', value: 'stretch' },
] as const
export type ScalingOption = typeof SCALING_OPTIONS[number]['value']


// Wallpaper compatibility status
export const COMPATIBILITY_OPTIONS = [
  { label: 'Perfect', value: 'perfect', color: 'green', textColor: 'text-green-500', bgColor: 'bg-green-500' },
  { label: 'Minor Issues', value: 'minor', color: 'yellow', textColor: 'text-yellow-500', bgColor: 'bg-yellow-500' },
  { label: 'Major Issues', value: 'major', color: 'orange', textColor: 'text-orange-500', bgColor: 'bg-orange-500' },
  { label: 'Broken', value: 'broken', color: 'red', textColor: 'text-red-500', bgColor: 'bg-red-500' },
  { label: 'Unknown', value: 'unknown', color: 'gray', textColor: 'text-muted-foreground', bgColor: 'bg-muted-foreground/50' },
] as const
export type CompatibilityStatus = typeof COMPATIBILITY_OPTIONS[number]['value']

// Lookup map keyed by status value for quick access
export const COMPATIBILITY_CONFIG = Object.fromEntries(
  COMPATIBILITY_OPTIONS.map(opt => [opt.value, opt])
) as Record<CompatibilityStatus, typeof COMPATIBILITY_OPTIONS[number]>


// Wallpaper type labels for display
export const WALLPAPER_TYPE_LABELS = {
  scene: "Scene",
  video: "Video",
  web: "Web",
  application: "Application",
} as const

export type WallpaperType = keyof typeof WALLPAPER_TYPE_LABELS

// Filter & sort types
export type WallpaperFilterType = 'all' | WallpaperType

export const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Date Added', value: 'date' },
  { label: 'Size', value: 'size' },
  { label: 'Recent', value: 'recent' },
] as const
export type SortBy = typeof SORT_OPTIONS[number]['value']

export const SORT_ORDER_OPTIONS = [
  { label: 'Ascending', value: 'asc' },
  { label: 'Descending', value: 'desc' },
] as const
export type SortOrder = typeof SORT_ORDER_OPTIONS[number]['value']

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

  // Paths (backend supported)
  assetsDir: string | null

  // App settings (not backend, managed by our app)
  theme: ThemeOption
  launchOnLogin: boolean
  minimizeOnClose: boolean
  restoreLastWallpaper: boolean
  lastWallpaperId: string | null
  lastWallpaperScreen: string | null
  showCompatibilityDot: boolean
  showStatusBar: boolean
  dynamicBackground: boolean
  onboardingComplete: boolean
  dismissedScanReminder: boolean

  // Persisted filter & sort preferences
  filterType: WallpaperFilterType[]
  filterTags: string[]
  filterResolution:string[]

  filterCompatibility: CompatibilityStatus[]
  sortBy: SortBy
  sortOrder: SortOrder
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

  // Paths
  assetsDir: null,

  // App
  theme: 'system',
  launchOnLogin: false,
  minimizeOnClose: false,
  restoreLastWallpaper: true,
  lastWallpaperId: null,
  lastWallpaperScreen: null,
  showCompatibilityDot: true,
  showStatusBar: true,
  dynamicBackground: true,
  onboardingComplete: false,
  dismissedScanReminder: false,

  // Filters & sort
  filterType: [],
  filterTags: [],
  filterResolution:[],
  filterCompatibility: [],
  sortBy: 'name',
  sortOrder: 'asc',
}



// FPS presets - base options that will be filtered based on display capabilities
export const BASE_FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240, 360] as const
export type BaseFpsOption = typeof BASE_FPS_OPTIONS[number]


// Wallpaper data shape returned by scanning
export interface Wallpaper {
  id: string
  workshopId?: string
  title: string
  author: string
  type: WallpaperType
  thumbnail: string
  previewUrl?: string
  resolution: { width: number; height: number }
  fileSize: number
  dateAdded: number
  tags: string[]
  installed: boolean
  path: string
}

// Options for applying a wallpaper via the backend
export interface ApplyWallpaperOptions {
  backgroundId: string
  screen?: string
  scaling?: ScalingOption
  fps?: number
  volume?: number
  silent?: boolean
  noAutomute?: boolean
  noAudioProcessing?: boolean
  disableMouse?: boolean
  disableParallax?: boolean
  noFullscreenPause?: boolean
  windowed?: { x: number; y: number; width: number; height: number }
}

// Per-wallpaper setting overrides (all optional, falls back to global settings)
export interface WallpaperOverrides {
  volume?: number
  audioProcessing?: boolean
  scaling?: ScalingOption
  disableMouse?: boolean
  disableParallax?: boolean
  compatibility?: CompatibilityStatus
  autoErrors?: string[]
  lastTested?: number
}

// App info
export const APP_NAME = 'Linux Wallpaper Engine'
export const APP_VERSION = '1.0.0'


// Steam paths to search for wallpapers
export const STEAM_PATHS = [
  '~/.local/share/Steam',
  '~/.steam/steam',
  '~/.var/app/com.valvesoftware.Steam/.local/share/Steam',
  '~/.var/app/com.valvesoftware.Steam/.data/Steam',
  '~/.var/app/com.valvesoftware.Steam/.steam/steam',
]

export const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Compatibility scan progress
export interface ScanProgress {
  running: boolean
  current: string
  total: number
  scanned: number
  aborted: boolean
}

export const DEFAULT_SCAN_PROGRESS: ScanProgress = {
  running: false,
  current: '',
  total: 0,
  scanned: 0,
  aborted: false,
}

// Patterns used to classify wallpaper stderr output during compatibility scanning
export const BROKEN_PATTERNS = [
  /segmentation fault/i,
  /segfault/i,
  /failed to initialize glfw/i,
  /glfw.*error/i,
  /abort.*core dumped/i,
  /cannot open display/i,
]

export const MINOR_PATTERNS = [
  /missing texture/i,
  /missing shader/i,
  /missing material/i,
  /scenescript/i,
  /cannot find/i,
  /warning/i,
  /not supported/i,
  /failed to load/i,
]