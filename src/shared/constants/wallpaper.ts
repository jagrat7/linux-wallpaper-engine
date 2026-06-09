import type { CompatibilityStatus } from './compatibility'
import { SCALING_OPTIONS, type ScalingOption } from './display'

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
export const WALLPAPER_APPLY_FAILED_MESSAGE = 'Wallpaper failed to apply. It may not be compatible.'

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
  // Passed to the backend as --set-property name=value (see --list-properties)
  customProperties?: Record<string, string>
  compatibility?: CompatibilityStatus
  autoErrors?: string[]
  lastTested?: number
}

// Per-wallpaper engine flag overrides: each row falls back to a global app
// setting (globalKey), then to a static default. `control` is the runtime
// discriminant for which UI control to render. Adding a new overridable
// flag is one entry here (plus its WallpaperOverrides field and zod schema).
export const ENGINE_OVERRIDE_FIELDS = [
  { control: 'select', key: 'scaling', globalKey: 'defaultScaling', label: 'Scaling', options: SCALING_OPTIONS, fallback: 'fill' },
  { control: 'slider', key: 'volume', globalKey: 'volume', label: 'Volume', min: 0, max: 100, suffix: '%', fallback: 100 },
  { control: 'switch', key: 'audioProcessing', globalKey: 'audioProcessing', label: 'Audio reactive effects', fallback: true },
  { control: 'switch', key: 'disableMouse', globalKey: 'disableMouse', label: 'Disable mouse interaction', fallback: false },
  { control: 'switch', key: 'disableParallax', globalKey: 'disableParallax', label: 'Disable parallax effect', fallback: false },
] as const
export type EngineOverrideField = typeof ENGINE_OVERRIDE_FIELDS[number]

// Property types from project.json `general.properties` that get a UI control.
// Other types (text headings, groups, scenetexture, file) are display-only or unsupported.
export const PROPERTY_CONTROL_TYPES = ['bool', 'slider', 'combo', 'color', 'textinput'] as const

// A customizable property exposed by a wallpaper's project.json.
// `value` is the wallpaper's default, serialized to --set-property string form.
export interface WallpaperProperty {
  name: string
  type: typeof PROPERTY_CONTROL_TYPES[number]
  text: string
  value: string
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: string }>
}
