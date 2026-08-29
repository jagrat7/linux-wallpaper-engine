import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { SystemThemePalette, ThemeFallbackProvider } from '../system-theme.types'
import { subtleSidebarColor } from '../system-theme.utils'

export const PYWAL_THEME_PATH = path.join(homedir(), '.cache/wal/colors.json')

export const readPywalPalette = (): SystemThemePalette | null => {
  try {
    const data = JSON.parse(readFileSync(PYWAL_THEME_PATH, 'utf8')) as {
      special?: Record<string, string>
      colors?: Record<string, string>
    }
    const background = data.special?.background
    const foreground = data.special?.foreground
    if (background === undefined || foreground === undefined) return null
    return {
      background,
      foreground,
      card: data.colors?.color0,
      cardForeground: foreground,
      primary: data.colors?.color4 ?? foreground,
      primaryForeground: background,
      secondary: data.colors?.color8,
      secondaryForeground: foreground,
      muted: data.colors?.color0,
      mutedForeground: data.colors?.color7,
      accent: data.colors?.color6 ?? data.colors?.color4,
      accentForeground: background,
      destructive: data.colors?.color1,
      border: data.colors?.color8,
      input: data.colors?.color0,
      success: data.colors?.color2,
      warning: data.colors?.color3,
      ring: data.colors?.color4,
      sidebar: background,
      sidebarForeground: foreground,
      sidebarPrimary: subtleSidebarColor(data.colors?.color4, background),
      sidebarPrimaryForeground: foreground,
      sidebarAccent: data.colors?.color0,
      sidebarAccentForeground: foreground,
      sidebarBorder: data.colors?.color8,
      sidebarRing: data.colors?.color4,
    }
  } catch {
    return null
  }
}

export const pywalThemeProvider = {
  watchPaths: [PYWAL_THEME_PATH],
  read: () => {
    const palette = readPywalPalette()
    return palette === null ? null : { scheme: null, palette }
  },
} satisfies ThemeFallbackProvider
