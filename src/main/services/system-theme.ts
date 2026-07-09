import { readFileSync, unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { invalidationService } from './invalidation'

const CONFIG_PATH = path.join(homedir(), '.config')
const OMARCHY_THEME_PATH = path.join(CONFIG_PATH, 'omarchy/current/theme/colors.toml')
const COSMIC_CONFIG_PATH = path.join(CONFIG_PATH, 'cosmic')
const COSMIC_MODE_PATH = path.join(
  COSMIC_CONFIG_PATH,
  'com.system76.CosmicTheme.Mode/v1/is_dark',
)
const COSMIC_COLOR_NAMES = [
  'background',
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
] as const
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
}>

const readText = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

const parseRonColor = (source: string | null, marker?: string): string | undefined => {
  if (source === null) return undefined
  const start = marker === undefined ? 0 : source.indexOf(`${marker}: (`)
  if (start < 0) return undefined

  const match = source.slice(start).match(RON_COLOR_PATTERN)
  if (match === null) return undefined
  return `color(srgb ${match[1]} ${match[2]} ${match[3]} / ${match[4]})`
}

const readCosmicPalette = (): SystemThemePalette | null => {
  const mode = readText(COSMIC_MODE_PATH)?.trim() === 'true' ? 'Dark' : 'Light'
  const themePath = path.join(
    COSMIC_CONFIG_PATH,
    `com.system76.CosmicTheme.${mode}/v1`,
  )
  const colors = Object.fromEntries(COSMIC_COLOR_NAMES.map((name) => [
    name,
    readText(path.join(themePath, name)),
  ])) as Record<typeof COSMIC_COLOR_NAMES[number], string | null>

  const background = parseRonColor(colors.background)
  const foreground = parseRonColor(colors.background, 'on')
  if (background === undefined || foreground === undefined) return null

  return {
    background,
    foreground,
    card: parseRonColor(colors.primary),
    cardForeground: parseRonColor(colors.primary, 'on'),
    primary: parseRonColor(colors.accent),
    primaryForeground: parseRonColor(colors.accent, 'on'),
    secondary: parseRonColor(colors.secondary),
    secondaryForeground: parseRonColor(colors.secondary, 'on'),
    muted: parseRonColor(colors.background, 'component'),
    mutedForeground: parseRonColor(colors.secondary, 'on_disabled'),
    accent: parseRonColor(colors.accent, 'selected'),
    accentForeground: parseRonColor(colors.accent, 'on'),
    destructive: parseRonColor(colors.destructive),
    border: parseRonColor(colors.background, 'divider'),
    input: parseRonColor(colors.background, 'component'),
    success: parseRonColor(colors.success),
    warning: parseRonColor(colors.warning),
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
  }
}

const getWatchPaths = (): string[] => [
  OMARCHY_THEME_PATH,
  COSMIC_MODE_PATH,
  ...['Dark', 'Light'].flatMap((mode) => COSMIC_COLOR_NAMES.map((name) => path.join(
    COSMIC_CONFIG_PATH,
    `com.system76.CosmicTheme.${mode}/v1/${name}`,
  ))),
]

let watching = false

export const systemThemeService = {
  getPalette(): SystemThemePalette | null {
    const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? ''
    return desktop.includes('cosmic')
      ? readCosmicPalette()
      : readOmarchyPalette() ?? readCosmicPalette()
  },
  startWatching() {
    if (watching) return
    watching = true
    getWatchPaths().forEach((filePath) => {
      watchFile(filePath, { interval: WATCH_INTERVAL_MS }, () => {
        invalidationService.emit('settings.systemTheme')
      })
    })
  },
  stopWatching() {
    if (!watching) return
    getWatchPaths().forEach((filePath) => unwatchFile(filePath))
    watching = false
  },
}
