export const WALLPAPER_GRID_MIN_CARD_WIDTH = {
  compact: 160,
  medium: 200,
  large: 320,
} as const

export type WallpaperGridDensity = keyof typeof WALLPAPER_GRID_MIN_CARD_WIDTH

export const WALLPAPER_GRID_DENSITY_OPTIONS: ReadonlyArray<{
  label: string
  value: WallpaperGridDensity
}> = [
  { label: 'Compact', value: 'compact' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
]

export const DEFAULT_WALLPAPER_GRID_DENSITY: WallpaperGridDensity = 'medium'

export const WALLPAPER_GRID_SKELETON_COUNT = 20

export const WALLPAPER_GRID_GAP = 16

export const MAX_WALLPAPER_GRID_COLUMNS = 6

export const DISCOVER_SECTION_BATCH_SIZE = 4
export const SKELETON_SECTION_COUNT = 2
export const SKELETON_CARDS_PER_SECTION = 6
