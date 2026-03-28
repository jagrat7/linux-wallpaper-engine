import type { CompatibilityStatus } from './compatibility'
import type { ScalingOption } from './display'

// Wallpaper type labels for display
export const WALLPAPER_TYPE_LABELS = {
  scene: "Scene",
  video: "Video",
  web: "Web",
  application: "Application",
} as const

export type WallpaperType = keyof typeof WALLPAPER_TYPE_LABELS

// Filter type
export type WallpaperFilterType = 'all' | WallpaperType

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
