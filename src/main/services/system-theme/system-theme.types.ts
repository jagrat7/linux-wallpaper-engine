export type SystemThemePalette = Partial<{
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  border: string
  input: string
  success: string
  warning: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
}>

export type ThemeScheme = 'light' | 'dark'

export type SystemTheme = {
  scheme: ThemeScheme
  palette: SystemThemePalette | null
}

export type DesktopThemeProvider = {
  matches: (desktop: string) => boolean
  watchPaths: readonly string[]
  readPalette: () => SystemThemePalette | null
}
