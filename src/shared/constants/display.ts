// Scaling options for display
export const SCALING_OPTIONS = [
  { label: 'Default', value: 'default' },
  { label: 'Fill', value: 'fill' },
  { label: 'Fit', value: 'fit' },
  { label: 'Stretch', value: 'stretch' },
] as const
export type ScalingOption = typeof SCALING_OPTIONS[number]['value']

// FPS presets - base options that will be filtered based on display capabilities
export const BASE_FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240, 360] as const
export type BaseFpsOption = typeof BASE_FPS_OPTIONS[number]

export const DEFAULT_DISPLAY_WIDTH = 1920
export const DEFAULT_DISPLAY_HEIGHT = 1080
export const DEFAULT_REFRESH_RATE = 60

export const DRM_PATH = '/sys/class/drm'
export const DRM_CONNECTOR_PATTERN = /^card\d+-(.+)$/

export const DISPLAY_COMMANDS = {
  hyprlandMonitors: 'hyprctl monitors -j',
  xrandrQuery: 'xrandr --query',
  wlrRandr: 'wlr-randr',
  gnomeRandrQuery: 'gnome-randr query',
} as const
