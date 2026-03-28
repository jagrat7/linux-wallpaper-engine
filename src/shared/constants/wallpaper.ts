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
  disableParticles?: boolean
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
  disableParticles?: boolean
  customProperties?: string[]
  compatibility?: CompatibilityStatus
  autoErrors?: string[]
  lastTested?: number
}
