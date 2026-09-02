import { homedir } from 'node:os'
import path from 'node:path'
import type { DesktopThemeProvider, SystemThemePalette } from '../system-theme.types'
import { inferScheme, readText, subtleSidebarColor } from '../system-theme.utils'

const HEX_COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i

export const getVanillaHyprlandPaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.config/hypr/hyprland.conf'),
  path.join(homeDirectory, '.config/hypr/colors.conf'),
]

export const getPywalThemePaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.cache/wal/colors.sh'),
]

export const getHyprlandWatchPaths = (homeDirectory: string): string[] => [
  ...getPywalThemePaths(homeDirectory),
  ...getVanillaHyprlandPaths(homeDirectory),
]

const PYWAL_THEME_PATHS = getPywalThemePaths(homedir())
const VANILLA_HYPRLAND_PATHS = getVanillaHyprlandPaths(homedir())
const HYPRLAND_WATCH_PATHS = getHyprlandWatchPaths(homedir())

export const parseKeyValueTheme = (source: string): SystemThemePalette | null => {
  const colors = Object.fromEntries(Array.from(source.matchAll(
    /^\s*([\w]+)\s*=\s*["']([^"']+)["']/gm,
  )).filter(([, , value]) => HEX_COLOR_PATTERN.test(value)).map(([, key, value]) => [
    key,
    value,
  ])) as Record<string, string>

  if (colors.background === undefined || colors.foreground === undefined) return null
  const accent = colors.accent ?? colors.blue ?? colors.color4
  const selection = colors.selection ?? colors.selection_background ?? accent
  const selectionForeground = colors.selection_foreground
    ?? colors.bright_foreground
    ?? colors.color15
    ?? colors.foreground
  const surface = colors.lighter_background
    ?? colors.color0
    ?? colors.dark_background
    ?? colors.background
  const mutedForeground = colors.muted
    ?? colors.dark_foreground
    ?? colors.color7
    ?? colors.color8
    ?? colors.foreground
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

const parseHyprColor = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined
  const match = value.match(/#([\da-f]{6})(?:[\da-f]{2})?/i)
    ?? value.match(/rgba?\(\s*([\da-f]{6})(?:[\da-f]{2})?\s*\)/i)
    ?? value.match(/^\s*["']?([\da-f]{6})(?:[\da-f]{2})?["']?\s*$/i)
  return match === null ? undefined : `#${match[1]}`
}

const findLuaVariableColor = (source: string, names: string[]): string | undefined => {
  for (const name of names) {
    const declaration = source.match(new RegExp(`\\blocal\\s+${name}\\s*=`, 'i'))
    if (declaration?.index === undefined) continue
    const start = declaration.index + declaration[0].length
    const end = source.slice(start).search(/\n\s*(?:local\s+|hl\.|o\.)/)
    const expression = source.slice(start, end < 0 ? undefined : start + end)
    const color = parseHyprColor(expression)
    if (color !== undefined) return color
  }
  return undefined
}

const findLuaAssignedColor = (source: string, keys: string[]): string | undefined => {
  for (const key of keys) {
    const assignment = source.match(new RegExp(`(?:\\[\"${key.replace('.', '\\.') }\"\\]|\\b${key.replace('.', '\\.')})\\s*=\\s*([^,\\n}]+)`, 'i'))
    if (assignment === null) continue
    const direct = parseHyprColor(assignment[1])
    if (direct !== undefined) return direct
    const variable = assignment[1].trim().match(/^([\w]+)$/)?.[1]
    if (variable !== undefined) {
      const resolved = findLuaVariableColor(source, [variable])
      if (resolved !== undefined) return resolved
    }
    const fromTable = parseHyprColor(source.slice(assignment.index, (assignment.index ?? 0) + 500))
    if (fromTable !== undefined) return fromTable
  }
  return undefined
}

export const parseHyprlandTheme = (source: string): SystemThemePalette | null => {
  const namedColors = Object.fromEntries(Array.from(source.matchAll(
    /^\s*(background|bg|surface|surface_alt|foreground|fg|accent|active|border|muted)\s*=\s*["']([^"']+)["']/gim,
  )).map(([, key, value]) => [key.toLowerCase(), parseHyprColor(value)]).filter((entry): entry is [string, string] => entry[1] !== undefined))

  const background = namedColors.background ?? namedColors.bg
  const foreground = namedColors.foreground ?? namedColors.fg
  const activeBorder = namedColors.accent
    ?? namedColors.active
    ?? findLuaVariableColor(source, ['active_border_color', 'activeBorderColor'])
    ?? findLuaAssignedColor(source, ['col.active_border', 'active_border', 'border_active'])
  const inactiveBorder = namedColors.border
    ?? namedColors.muted
    ?? findLuaVariableColor(source, ['inactive_border_color', 'inactiveBorderColor'])
    ?? findLuaAssignedColor(source, ['col.inactive_border', 'inactive_border', 'border_inactive'])
  const surface = namedColors.surface ?? background
  const selection = namedColors.surface_alt ?? inactiveBorder ?? surface

  if (background === undefined && foreground === undefined
    && activeBorder === undefined && inactiveBorder === undefined) return null

  const activeForeground = background
    ?? (inferScheme(activeBorder) === 'light' ? '#000000' : '#ffffff')
  return {
    background,
    foreground,
    card: surface,
    cardForeground: foreground,
    primary: activeBorder,
    primaryForeground: activeForeground,
    secondary: surface,
    secondaryForeground: foreground,
    muted: surface,
    mutedForeground: foreground,
    accent: selection,
    accentForeground: foreground,
    border: inactiveBorder,
    input: surface,
    ring: activeBorder,
    sidebar: background,
    sidebarForeground: foreground,
    sidebarPrimary: subtleSidebarColor(activeBorder, background),
    sidebarPrimaryForeground: foreground,
    sidebarAccent: selection,
    sidebarAccentForeground: foreground,
    sidebarBorder: inactiveBorder,
    sidebarRing: activeBorder,
  }
}

export const readFirstPalette = (
  filePaths: readonly string[],
  parse: (source: string) => SystemThemePalette | null,
): SystemThemePalette | null => {
  for (const filePath of filePaths) {
    const source = readText(filePath)
    if (source === null) continue
    const theme = parse(source)
    if (theme !== null) return theme
  }
  return null
}

export const hyprlandThemeProvider = {
  matches: (desktop: string) => desktop.includes('hyprland'),
  watchPaths: HYPRLAND_WATCH_PATHS,
  readPalette: () =>
    readFirstPalette(PYWAL_THEME_PATHS, parseKeyValueTheme)
    ?? readFirstPalette(VANILLA_HYPRLAND_PATHS, parseHyprlandTheme),
} satisfies DesktopThemeProvider
