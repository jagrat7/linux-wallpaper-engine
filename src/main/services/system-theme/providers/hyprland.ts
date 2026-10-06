import { homedir } from 'node:os'
import path from 'node:path'
import type { DesktopThemeProvider, SystemThemePalette } from '../system-theme.types'
import { inferScheme, readText, subtleSidebarColor } from '../system-theme.utils'
import {
  getOmarchyHyprlandPaths,
  getOmarchyThemePaths,
  getOmarchyWatchPaths,
  parseOmarchyTheme,
} from './omarchy'

export const getHyprlandConfigPaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.config/hypr/hyprland.lua'),
  path.join(homeDirectory, '.config/hypr/hyprland.conf'),
  // Conventional home for colour variables sourced by hyprland.conf.
  path.join(homeDirectory, '.config/hypr/colors.conf'),
]

const OMARCHY_THEME_PATHS = getOmarchyThemePaths(homedir())
const OMARCHY_HYPRLAND_PATHS = getOmarchyHyprlandPaths(homedir())
const HYPRLAND_CONFIG_PATHS = getHyprlandConfigPaths(homedir())

const stripComments = (source: string): string => source.replace(/^\s*(?:#|--).*$/gm, '')

const resolveHyprlangVariables = (source: string): string => {
  const variables = new Map(
    Array.from(source.matchAll(/^\s*\$(\w+)\s*=\s*(.+)$/gm), ([, name, value]) => [
      name,
      value.trim(),
    ]),
  )
  return source.replace(
    /\$(\w+)\b(?!\s*=)/g,
    (reference, name: string) => variables.get(name) ?? reference,
  )
}

const parseHyprColor = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined
  const match =
    value.match(/#([\da-f]{6})(?:[\da-f]{2})?/i) ??
    value.match(/rgba?\(\s*([\da-f]{6})(?:[\da-f]{2})?\s*\)/i) ??
    value.match(/^\s*["']?([\da-f]{6})(?:[\da-f]{2})?["']?\s*$/i)
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
    const assignment = source.match(
      new RegExp(
        `(?:\\["${key.replace('.', '\\.')}"\\]|\\b${key.replace('.', '\\.')})\\s*=\\s*([^,\\n}]+)`,
        'i',
      ),
    )
    if (assignment === null) continue
    const direct = parseHyprColor(assignment[1])
    if (direct !== undefined) return direct
    const variable = assignment[1].trim().match(/^([\w]+)$/)?.[1]
    if (variable !== undefined) {
      const resolved = findLuaVariableColor(source, [variable])
      if (resolved !== undefined) return resolved
    }
    // Only look past the line for a multi-line table, not an unresolved reference.
    if (!assignment[1].trim().startsWith('{')) continue
    const fromTable = parseHyprColor(source.slice(assignment.index, (assignment.index ?? 0) + 500))
    if (fromTable !== undefined) return fromTable
  }
  return undefined
}

export const parseHyprlandTheme = (rawSource: string): SystemThemePalette | null => {
  const source = resolveHyprlangVariables(stripComments(rawSource))
  const namedColors = Object.fromEntries(
    Array.from(
      source.matchAll(
        /^\s*\$?(background|bg|surface|surface_alt|foreground|fg|accent|active|border|muted)\s*=\s*["']?([^"'\n]+)/gim,
      ),
    )
      .map(([, key, value]) => [key.toLowerCase(), parseHyprColor(value)])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  )

  const background = namedColors.background ?? namedColors.bg
  const foreground = namedColors.foreground ?? namedColors.fg
  const activeBorder =
    namedColors.accent ??
    namedColors.active ??
    findLuaVariableColor(source, ['active_border_color', 'activeBorderColor']) ??
    findLuaAssignedColor(source, ['col.active_border', 'active_border', 'border_active'])
  const inactiveBorder =
    namedColors.border ??
    namedColors.muted ??
    findLuaVariableColor(source, ['inactive_border_color', 'inactiveBorderColor']) ??
    findLuaAssignedColor(source, ['col.inactive_border', 'inactive_border', 'border_inactive'])
  const surface = namedColors.surface ?? background
  const selection = namedColors.surface_alt ?? inactiveBorder ?? surface

  if (
    background === undefined &&
    foreground === undefined &&
    activeBorder === undefined &&
    inactiveBorder === undefined
  )
    return null

  const activeForeground =
    background ?? (inferScheme(activeBorder) === 'light' ? '#000000' : '#ffffff')
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

const readFirstPalette = (
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

// Read the user's config files together so variables and colours split across
// hyprland.conf and a sourced colors.conf resolve as one config.
const readHyprlandConfigPalette = (): SystemThemePalette | null =>
  parseHyprlandTheme(HYPRLAND_CONFIG_PATHS.map((filePath) => readText(filePath) ?? '').join('\n'))

export const hyprlandThemeProvider = {
  matches: (desktop: string) => desktop.includes('hyprland') || desktop.includes('omarchy'),
  watchPaths: [...getOmarchyWatchPaths(homedir()), ...HYPRLAND_CONFIG_PATHS],
  readPalette: () =>
    readFirstPalette(OMARCHY_THEME_PATHS, parseOmarchyTheme) ??
    readFirstPalette(OMARCHY_HYPRLAND_PATHS, parseHyprlandTheme) ??
    readHyprlandConfigPalette(),
} satisfies DesktopThemeProvider
