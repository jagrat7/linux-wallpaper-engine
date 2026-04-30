import type { CompatibilityStatus } from './compatibility'
import type { ScalingOption } from './display'

// Single source of truth for wallpaper filter/type options
export const FILTER_TYPE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Scene', value: 'scene' },
  { label: 'Video', value: 'video' },
  { label: 'Web', value: 'web' },
  { label: 'Application', value: 'application' },
] as const
export type WallpaperFilterType = typeof FILTER_TYPE_OPTIONS[number]['value']
export type WallpaperType = Exclude<WallpaperFilterType, 'all'>
export type WindowGeometry = { x: number; y: number; width: number; height: number }

export const BACKEND_NOT_INSTALLED_ERROR_MESSAGE = 'linux-wallpaperengine is not installed or is not available on PATH'

export const AGE_RATINGS = {
  g: { label: 'G', workshopTag: 'Everyone' },
  pg13: { label: 'PG13', workshopTag: 'Questionable' },
  r: { label: 'R', workshopTag: 'Mature' },
} as const
export type AgeRating = keyof typeof AGE_RATINGS
export const AGE_RATING_OPTIONS = Object.entries(AGE_RATINGS).map(([value, config]) => ({
  label: config.label,
  value,
})) as Array<{ label: typeof AGE_RATINGS[AgeRating]['label']; value: AgeRating }>

// Wallpaper type labels for display (derived from FILTER_TYPE_OPTIONS)
export const WALLPAPER_TYPE_LABELS = Object.fromEntries(
  FILTER_TYPE_OPTIONS.filter(o => o.value !== 'all').map(o => [o.value, o.label])
) as Record<WallpaperType, string>

// Wallpaper data shape returned by scanning
export interface Wallpaper {
  id: string
  workshopId?: string
  title: string
  author: string
  ageRating?: AgeRating
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
  windowed?: WindowGeometry | 'emit-flag'
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
