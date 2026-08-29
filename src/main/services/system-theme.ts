import { readFileSync, unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { hostExecAsync } from '../utils/host'
import { invalidationService } from './invalidation'

const CONFIG_PATH = path.join(homedir(), '.config')
export const getOmarchyThemePaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/colors.toml'),
  // Omarchy used this location before moving runtime state out of ~/.config.
  path.join(homeDirectory, '.config/omarchy/current/theme/colors.toml'),
]
const OMARCHY_THEME_PATHS = getOmarchyThemePaths(homedir())
export const getOmarchyHyprlandPaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/hyprland.lua'),
  path.join(homeDirectory, '.config/omarchy/current/theme/hyprland.lua'),
]
const OMARCHY_HYPRLAND_PATHS = getOmarchyHyprlandPaths(homedir())
const PYWAL_THEME_PATH = path.join(homedir(), '.cache/wal/colors.json')
const COSMIC_CONFIG_PATH = path.join(CONFIG_PATH, 'cosmic')
const COSMIC_MODE_PATH = path.join(COSMIC_CONFIG_PATH, 'com.system76.CosmicTheme.Mode/v1/is_dark')
const KDE_THEME_PATH = path.join(CONFIG_PATH, 'kdeglobals')
const PORTAL_DESTINATION = 'org.freedesktop.portal.Desktop'
const PORTAL_PATH = '/org/freedesktop/portal/desktop'
const PORTAL_INTERFACE = 'org.freedesktop.portal.Settings'
const PORTAL_NAMESPACE = 'org.freedesktop.appearance'
const POLL_INTERVAL_MS = 5000
const WATCH_INTERVAL_MS = 1000
const HEX_COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i
const RON_COLOR_PATTERN = /red:\s*([\d.]+),\s*green:\s*([\d.]+),\s*blue:\s*([\d.]+),\s*alpha:\s*([\d.]+)/

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

export type SystemTheme = {
  scheme: 'light' | 'dark'
  palette: SystemThemePalette | null
}

type OmarchyTheme = {
  scheme: SystemTheme['scheme'] | null
  palette: SystemThemePalette
}

const readText = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

const readPortalSetting = async (setting: string): Promise<string | null> => {
  const commands = [
    `gdbus call --session --dest ${PORTAL_DESTINATION} --object-path ${PORTAL_PATH} --method ${PORTAL_INTERFACE}.Read ${PORTAL_NAMESPACE} ${setting}`,
    `busctl --user call ${PORTAL_DESTINATION} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read ss ${PORTAL_NAMESPACE} ${setting}`,
    `dbus-send --session --print-reply --dest=${PORTAL_DESTINATION} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read string:${PORTAL_NAMESPACE} string:${setting}`,
  ]

  for (const command of commands) {
    try {
      return (await hostExecAsync(command)).stdout
    } catch {
      continue
    }
  }
  return null
}

const parsePortalScheme = (source: string | null): SystemTheme['scheme'] | null => {
  const value = source?.match(/(?:uint32|\bu)\s+(\d+)/)?.[1]
  if (value === '1') return 'dark'
  if (value === '2') return 'light'
  return null
}

const parsePortalAccent = (source: string | null): string | null => {
  if (source === null) return null
  const tuple = source.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/)
    ?? source.match(/\(ddd\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (tuple !== null) return `color(srgb ${tuple[1]} ${tuple[2]} ${tuple[3]})`

  const values = Array.from(source.matchAll(/double\s+([\d.]+)/g))
  return values.length >= 3
    ? `color(srgb ${values[0][1]} ${values[1][1]} ${values[2][1]})`
    : null
}

const parseRonColor = (source: string | null, marker?: string): string | undefined => {
  if (source === null) return undefined
  const start = marker === undefined ? 0 : source.indexOf(`${marker}: (`)
  if (start < 0) return undefined
  const match = source.slice(start).match(RON_COLOR_PATTERN)
  return match === null
    ? undefined
    : `color(srgb ${match[1]} ${match[2]} ${match[3]} / ${match[4]})`
}

const subtleSidebarColor = (
  accent: string | undefined,
  background?: string,
): string | undefined => accent === undefined
  ? undefined
  : `color-mix(in oklch, ${accent} 22%, ${background ?? 'var(--sidebar)'})`

const readCosmicPalette = (): SystemThemePalette | null => {
  const mode = readText(COSMIC_MODE_PATH)?.trim() === 'true' ? 'Dark' : 'Light'
  const themePath = path.join(COSMIC_CONFIG_PATH, `com.system76.CosmicTheme.${mode}/v1`)
  const readColor = (name: string) => readText(path.join(themePath, name))
  const backgroundSource = readColor('background')
  const primarySource = readColor('primary')
  const secondarySource = readColor('secondary')
  const accentSource = readColor('accent')
  const background = parseRonColor(backgroundSource)
  const foreground = parseRonColor(backgroundSource, 'on')
  if (background === undefined || foreground === undefined) return null

  const accent = parseRonColor(accentSource)
  const accentForeground = parseRonColor(accentSource, 'on')
  return {
    background,
    foreground,
    card: parseRonColor(primarySource),
    cardForeground: parseRonColor(primarySource, 'on'),
    primary: accent,
    primaryForeground: accentForeground,
    secondary: parseRonColor(secondarySource),
    secondaryForeground: parseRonColor(secondarySource, 'on'),
    muted: parseRonColor(backgroundSource, 'component'),
    mutedForeground: parseRonColor(secondarySource, 'on_disabled'),
    accent: parseRonColor(accentSource, 'selected') ?? accent,
    accentForeground,
    destructive: parseRonColor(readColor('destructive')),
    border: parseRonColor(backgroundSource, 'divider'),
    input: parseRonColor(backgroundSource, 'component'),
    success: parseRonColor(readColor('success')),
    warning: parseRonColor(readColor('warning')),
    ring: accent,
    sidebar: background,
    sidebarForeground: foreground,
    sidebarPrimary: subtleSidebarColor(accent, background),
    sidebarPrimaryForeground: foreground,
    sidebarAccent: parseRonColor(secondarySource),
    sidebarAccentForeground: parseRonColor(secondarySource, 'on'),
    sidebarBorder: parseRonColor(backgroundSource, 'divider'),
    sidebarRing: accent,
  }
}

const parseKdeColor = (value: string | undefined): string | undefined => {
  const channels = value?.split(',').slice(0, 3).map(Number)
  if (channels === undefined || channels.length !== 3 || !channels.every(Number.isFinite))
    return undefined
  return `rgb(${channels.join(' ')})`
}

const readKdePalette = (): SystemThemePalette | null => {
  const source = readText(KDE_THEME_PATH)
  if (source === null) return null
  const sections = new Map<string, Record<string, string>>()
  let section = ''
  source.split('\n').forEach((line) => {
    const header = line.match(/^\[([^\]]+)]$/)
    if (header !== null) {
      section = header[1]
      sections.set(section, sections.get(section) ?? {})
      return
    }
    const entry = line.match(/^([^=]+)=(.*)$/)
    if (entry !== null && section !== '')
      sections.get(section)![entry[1]] = entry[2]
  })

  const color = (group: string, key: string) => parseKdeColor(sections.get(group)?.[key])
  const background = color('Colors:Window', 'BackgroundNormal')
  const foreground = color('Colors:Window', 'ForegroundNormal')
  if (background === undefined || foreground === undefined) return null
  const accent = color('Colors:Selection', 'BackgroundNormal')
  const accentForeground = color('Colors:Selection', 'ForegroundNormal')
  return {
    background,
    foreground,
    card: color('Colors:View', 'BackgroundNormal'),
    cardForeground: color('Colors:View', 'ForegroundNormal'),
    primary: accent,
    primaryForeground: accentForeground,
    secondary: color('Colors:Button', 'BackgroundNormal'),
    secondaryForeground: color('Colors:Button', 'ForegroundNormal'),
    muted: color('Colors:Window', 'BackgroundAlternate'),
    mutedForeground: color('Colors:Window', 'ForegroundInactive'),
    accent,
    accentForeground,
    destructive: color('Colors:Window', 'ForegroundNegative'),
    border: color('Colors:Window', 'ForegroundInactive'),
    input: color('Colors:View', 'BackgroundNormal'),
    success: color('Colors:Window', 'ForegroundPositive'),
    warning: color('Colors:Window', 'ForegroundNeutral'),
    ring: accent,
    sidebar: background,
    sidebarForeground: foreground,
    sidebarPrimary: subtleSidebarColor(accent, background),
    sidebarPrimaryForeground: foreground,
    sidebarAccent: color('Colors:Button', 'BackgroundNormal'),
    sidebarAccentForeground: color('Colors:Button', 'ForegroundNormal'),
    sidebarBorder: color('Colors:Window', 'ForegroundInactive'),
    sidebarRing: accent,
  }
}

export const parseOmarchyTheme = (source: string): OmarchyTheme | null => {
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
  const mode = source.match(/^\s*mode\s*=\s*["'](light|dark)["']/mi)?.[1]

  return {
    scheme: mode === 'light' || mode === 'dark'
      ? mode
      : inferScheme(colors.background) ?? 'dark',
    palette: {
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
    },
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

export const parseOmarchyHyprlandTheme = (source: string): OmarchyTheme | null => {
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
    scheme: inferScheme(background),
    palette: {
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
    },
  }
}

const readOmarchyTheme = (): OmarchyTheme | null => {
  for (const filePath of OMARCHY_THEME_PATHS) {
    const source = readText(filePath)
    if (source !== null) {
      const theme = parseOmarchyTheme(source)
      if (theme !== null) return theme
    }
  }

  for (const filePath of OMARCHY_HYPRLAND_PATHS) {
    const source = readText(filePath)
    if (source !== null) {
      const theme = parseOmarchyHyprlandTheme(source)
      if (theme !== null) return theme
    }
  }
  return null
}

const readPywalPalette = (): SystemThemePalette | null => {
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

const inferScheme = (background: string | undefined): SystemTheme['scheme'] | null => {
  if (background === undefined) return null
  const hex = background.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i)
  const functional = background.match(/(?:rgb|color\(srgb)\(?\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/)
  const channels = hex !== null
    ? hex.slice(1).map((value) => Number.parseInt(value, 16) / 255)
    : functional?.slice(1).map(Number)
  if (channels === undefined || channels.length < 3) return null
  const [red, green, blue] = channels.map((value) => value > 1 ? value / 255 : value)
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 0.5 ? 'dark' : 'light'
}

const detectTheme = async (): Promise<SystemTheme> => {
  const [schemeSource, accentSource] = await Promise.all([
    readPortalSetting('color-scheme'),
    readPortalSetting('accent-color'),
  ])
  const accent = parsePortalAccent(accentSource)
  const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? ''
  const omarchyTheme = desktop.includes('hyprland') || desktop.includes('omarchy')
    ? readOmarchyTheme()
    : null
  const desktopPalette = desktop.includes('cosmic')
    ? readCosmicPalette()
    : desktop.includes('kde') || desktop.includes('plasma')
      ? readKdePalette()
      : omarchyTheme?.palette ?? null
  const palette = desktopPalette ?? readPywalPalette()
  const cosmicMode = readText(COSMIC_MODE_PATH)?.trim()
  const desktopScheme = desktop.includes('cosmic')
    ? cosmicMode === undefined
      ? inferScheme(desktopPalette?.background)
      : cosmicMode === 'true' ? 'dark' : 'light'
    : omarchyTheme?.scheme ?? inferScheme(desktopPalette?.background)
  const mergedPalette = palette === null
    ? accent === null ? null : {
      primary: accent,
      accent,
      ring: accent,
      sidebarPrimary: subtleSidebarColor(accent),
      sidebarRing: accent,
    }
    : accent === null ? palette : {
      primary: accent,
      accent,
      ring: accent,
      sidebarPrimary: subtleSidebarColor(accent, palette.background),
      sidebarRing: accent,
      ...palette,
    }

  return {
    scheme: desktopScheme
      ?? parsePortalScheme(schemeSource)
      ?? inferScheme(palette?.background)
      ?? 'dark',
    palette: mergedPalette,
  }
}

const COSMIC_THEME_PATHS = ['Dark', 'Light'].flatMap((mode) => [
  'background',
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
].map((name) => path.join(
  COSMIC_CONFIG_PATH,
  `com.system76.CosmicTheme.${mode}/v1/${name}`,
)))
const WATCH_PATHS = [
  COSMIC_MODE_PATH,
  ...COSMIC_THEME_PATHS,
  KDE_THEME_PATH,
  ...OMARCHY_THEME_PATHS,
  ...OMARCHY_HYPRLAND_PATHS,
  PYWAL_THEME_PATH,
]
let pollTimer: NodeJS.Timeout | null = null
let lastTheme = ''

const refreshTheme = async (): Promise<SystemTheme> => {
  const theme = await detectTheme()
  const serialized = JSON.stringify(theme)
  if (lastTheme !== '' && serialized !== lastTheme)
    invalidationService.emit('settings.systemTheme')
  lastTheme = serialized
  return theme
}

export const systemThemeService = {
  getTheme() {
    if (pollTimer === null) systemThemeService.startWatching()
    return refreshTheme()
  },
  startWatching() {
    if (pollTimer !== null) return
    pollTimer = setInterval(() => void refreshTheme(), POLL_INTERVAL_MS)
    WATCH_PATHS.forEach((filePath) => watchFile(
      filePath,
      { interval: WATCH_INTERVAL_MS },
      () => void refreshTheme(),
    ))
  },
  stopWatching() {
    if (pollTimer === null) return
    clearInterval(pollTimer)
    pollTimer = null
    WATCH_PATHS.forEach((filePath) => unwatchFile(filePath))
  },
}
