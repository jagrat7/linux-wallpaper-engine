import { readFileSync, unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { hostExecAsync } from '../utils/host'
import { invalidationService } from './invalidation'

const CONFIG_PATH = path.join(homedir(), '.config')
const OMARCHY_THEME_PATH = path.join(CONFIG_PATH, 'omarchy/current/theme/colors.toml')
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
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarRing: string
}>

export type SystemTheme = {
  scheme: 'light' | 'dark'
  palette: SystemThemePalette | null
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
    sidebarPrimary: accent,
    sidebarPrimaryForeground: accentForeground,
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
    sidebarPrimary: accent,
    sidebarPrimaryForeground: accentForeground,
    sidebarRing: accent,
  }
}

const readOmarchyPalette = (): SystemThemePalette | null => {
  const source = readText(OMARCHY_THEME_PATH)
  if (source === null) return null
  const colors = Object.fromEntries(Array.from(source.matchAll(
    /^\s*([\w]+)\s*=\s*["']([^"']+)["']/gm,
  )).filter(([, , value]) => HEX_COLOR_PATTERN.test(value)).map(([, key, value]) => [
    key,
    value,
  ])) as Record<string, string>

  if (colors.background === undefined || colors.foreground === undefined) return null
  return {
    background: colors.background,
    foreground: colors.foreground,
    card: colors.color0,
    cardForeground: colors.foreground,
    primary: colors.accent,
    primaryForeground: colors.selection_foreground,
    secondary: colors.color0,
    secondaryForeground: colors.foreground,
    muted: colors.color0,
    mutedForeground: colors.color7,
    accent: colors.selection_background ?? colors.accent,
    accentForeground: colors.selection_foreground,
    destructive: colors.color1,
    border: colors.color8,
    input: colors.color0,
    success: colors.color2,
    warning: colors.color3,
    ring: colors.accent,
    sidebarPrimary: colors.accent,
    sidebarPrimaryForeground: colors.selection_foreground,
    sidebarRing: colors.accent,
  }
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
      sidebarPrimary: data.colors?.color4,
      sidebarPrimaryForeground: background,
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
  const desktopPalette = desktop.includes('cosmic')
    ? readCosmicPalette()
    : desktop.includes('kde') || desktop.includes('plasma')
      ? readKdePalette()
      : desktop.includes('hyprland') || desktop.includes('omarchy')
        ? readOmarchyPalette()
        : null
  const palette = desktopPalette ?? readPywalPalette()
  const cosmicMode = readText(COSMIC_MODE_PATH)?.trim()
  const desktopScheme = desktop.includes('cosmic')
    ? cosmicMode === undefined
      ? inferScheme(desktopPalette?.background)
      : cosmicMode === 'true' ? 'dark' : 'light'
    : inferScheme(desktopPalette?.background)
  const mergedPalette = palette === null
    ? accent === null ? null : {
      primary: accent,
      accent,
      ring: accent,
      sidebarPrimary: accent,
      sidebarRing: accent,
    }
    : accent === null ? palette : {
      primary: accent,
      accent,
      ring: accent,
      sidebarPrimary: accent,
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
  OMARCHY_THEME_PATH,
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
