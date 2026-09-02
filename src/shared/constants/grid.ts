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
