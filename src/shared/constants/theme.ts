export const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Steam', value: 'steam' },
  { label: 'System', value: 'system' },
  { label: 'System Colors', value: 'system-colors' },
  { label: 'Hard Light', value: 'hard-light' },
] as const
export type ThemeOption = typeof THEME_OPTIONS[number]['value']

// Raw palette keys injected as --system-<key> CSS variables on the root
// element when the "System Colors" theme is active
export const SYSTEM_PALETTE_KEYS = [
  'background',
  'foreground',
  'accent',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
] as const
export type SystemPaletteKey = typeof SYSTEM_PALETTE_KEYS[number]

export type SystemThemeMode = 'light' | 'dark'

export type SystemThemePalette =
  Partial<Record<SystemPaletteKey, string>> &
  Record<'background' | 'foreground' | 'accent', string>

export type SystemTheme =
  | { source: 'omarchy'; mode: SystemThemeMode; palette: SystemThemePalette }
  | { source: 'accent'; mode: SystemThemeMode; accent: string }
  | { source: 'none'; mode: SystemThemeMode }
