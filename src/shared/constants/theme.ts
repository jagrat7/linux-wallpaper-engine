export const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Steam', value: 'steam' },
  { label: 'System', value: 'system' },
  { label: 'Hard Light', value: 'hard-light' },
] as const
export type ThemeOption = typeof THEME_OPTIONS[number]['value']

export type SystemColorScheme = 'light' | 'dark' | 'no-preference'

export interface SystemThemePalette {
  background: string
  foreground: string
  accent: string
  cursor?: string
  colors?: Record<string, string>
}

export interface SystemTheme {
  scheme: SystemColorScheme
  accent: string | null
  palette: SystemThemePalette | null
}

export const isLightTheme = (mode: ThemeOption, resolvedScheme?: SystemColorScheme): boolean => {
  if (mode === 'light' || mode === 'hard-light') return true
  if (mode === 'dark' || mode === 'steam') return false
  return resolvedScheme === 'light'
}
