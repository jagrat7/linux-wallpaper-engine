// Playlist settings
export const PLAYLIST_ORDER_OPTIONS = [
  { label: 'Sequential', value: 'sequential' },
  { label: 'Random', value: 'random' },
] as const
export type PlaylistOrder = typeof PLAYLIST_ORDER_OPTIONS[number]['value']
export const PLAYLIST_ORDER_VALUES = PLAYLIST_ORDER_OPTIONS.map(o => o.value) as [PlaylistOrder, ...PlaylistOrder[]]

export const PLAYLIST_TIME_UNIT_OPTIONS = [
  { label: 'min', value: 'minutes' },
  { label: 'hr', value: 'hours' },
] as const
export type PlaylistTimeUnit = typeof PLAYLIST_TIME_UNIT_OPTIONS[number]['value']
export const PLAYLIST_TIME_UNIT_VALUES = PLAYLIST_TIME_UNIT_OPTIONS.map(o => o.value) as [PlaylistTimeUnit, ...PlaylistTimeUnit[]]

export const PLAYLIST_MODE_OPTIONS = [
  { label: 'Timer', value: 'timer' },
] as const
export type PlaylistMode = typeof PLAYLIST_MODE_OPTIONS[number]['value']
export const PLAYLIST_MODE_VALUES = PLAYLIST_MODE_OPTIONS.map(o => o.value) as [PlaylistMode, ...PlaylistMode[]]

export interface PlaylistSettings {
  delay: number // minutes between switches (engine format)
  timeunit: PlaylistTimeUnit
  mode: PlaylistMode
  order: PlaylistOrder
  updateonpause: boolean
  videosequence: boolean
}

export const DEFAULT_PLAYLIST_SETTINGS: PlaylistSettings = {
  delay: 1,
  timeunit: PLAYLIST_TIME_UNIT_OPTIONS[0].value,
  mode: PLAYLIST_MODE_OPTIONS[0].value,
  order: PLAYLIST_ORDER_OPTIONS[0].value,
  updateonpause: false,
  videosequence: false,
}

export interface Playlist {
  name: string
  items: string[] // wallpaper paths
  settings: PlaylistSettings
  updatedAt?: number   // epoch ms — set on create/update
  lastAppliedAt?: number // epoch ms — set when playlist is started
}

// Steam Wallpaper Engine config.json structure
export interface SteamConfig {
  steamuser: {
    general: {
      playlists?: Playlist[]
    }
    wallpaperconfig?: {
      selectedwallpapers?: Record<string, { playlist?: Playlist }>
    }
  }
}
