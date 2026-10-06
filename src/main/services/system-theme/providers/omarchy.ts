import path from 'node:path'
import type { SystemThemePalette } from '../system-theme.types'
import { subtleSidebarColor } from '../system-theme.utils'

const HEX_COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i

export const getOmarchyThemePaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/colors.toml'),
  // Omarchy used this location before moving runtime state out of ~/.config.
  path.join(homeDirectory, '.config/omarchy/current/theme/colors.toml'),
]

export const getOmarchyHyprlandPaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/hyprland.lua'),
  path.join(homeDirectory, '.config/omarchy/current/theme/hyprland.lua'),
]

export const getOmarchyWatchPaths = (homeDirectory: string): string[] => [
  ...getOmarchyThemePaths(homeDirectory),
  ...getOmarchyHyprlandPaths(homeDirectory),
  // Theme switches replace the entire current/theme directory, then update this
  // marker in its stable parent directory.
  path.join(homeDirectory, '.local/state/omarchy/current/theme.name'),
]

export const parseOmarchyTheme = (source: string): SystemThemePalette | null => {
  const colors = Object.fromEntries(
    Array.from(source.matchAll(/^\s*([\w]+)\s*=\s*["']([^"']+)["']/gm))
      .filter(([, , value]) => HEX_COLOR_PATTERN.test(value))
      .map(([, key, value]) => [key, value]),
  ) as Record<string, string>

  if (colors.background === undefined || colors.foreground === undefined) return null
  const accent = colors.accent ?? colors.blue ?? colors.color4
  const selection = colors.selection ?? colors.selection_background ?? accent
  const selectionForeground =
    colors.selection_foreground ?? colors.bright_foreground ?? colors.color15 ?? colors.foreground
  const surface =
    colors.lighter_background ?? colors.color0 ?? colors.dark_background ?? colors.background
  const mutedForeground =
    colors.muted ?? colors.dark_foreground ?? colors.color7 ?? colors.color8 ?? colors.foreground
  return {
    background: colors.background,
    foreground: colors.foreground,
    card: surface,
    cardForeground: colors.foreground,
    primary: accent,
    primaryForeground: colors.background,
    secondary: surface,
    secondaryForeground: colors.foreground,
    muted: surface,
    mutedForeground,
    accent: selection,
    accentForeground: selectionForeground,
    destructive: colors.red ?? colors.color1,
    border: colors.muted ?? colors.color8,
    input: surface,
    success: colors.green ?? colors.color2,
    warning: colors.yellow ?? colors.color3,
    ring: accent,
    sidebar: colors.background,
    sidebarForeground: colors.foreground,
    sidebarPrimary: subtleSidebarColor(accent, colors.background),
    sidebarPrimaryForeground: colors.foreground,
    sidebarAccent: selection,
    sidebarAccentForeground: selectionForeground,
    sidebarBorder: colors.muted ?? colors.color8,
    sidebarRing: accent,
  }
}
