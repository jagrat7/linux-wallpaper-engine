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

export type ThemeSource =
  | 'xdg-portal'
  | 'cosmic'
  | 'kde'
  | 'omarchy'
  | 'fallback'

export type SystemTheme = {
  scheme: ThemeScheme
  palette: SystemThemePalette | null
  sources: {
    scheme: ThemeSource
    palette: ThemeSource | null
  }
}

// Providers may contribute a scheme, a palette, or both, but never an empty
// result. A provider with no usable information returns null instead.
export type ThemeContribution =
  | {
    scheme: ThemeScheme
    palette?: SystemThemePalette
  }
  | {
    scheme?: ThemeScheme
    palette: SystemThemePalette
  }

export type ThemeProviderContext = {
  desktop: string
  homeDirectory: string
}

export type ThemeProvider = {
  id: Exclude<ThemeSource, 'xdg-portal' | 'fallback'>
  priority: number
  matches: (context: ThemeProviderContext) => boolean
  watchPaths: (context: ThemeProviderContext) => readonly string[]
  read: (
    context: ThemeProviderContext,
  ) => ThemeContribution | null | Promise<ThemeContribution | null>
}
