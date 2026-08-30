import { homedir } from 'node:os'
import path from 'node:path'
import type { DesktopThemeProvider, SystemThemePalette } from '../system-theme.types'
import { readText, subtleSidebarColor } from '../system-theme.utils'

const RON_COLOR_PATTERN = /red:\s*([\d.]+),\s*green:\s*([\d.]+),\s*blue:\s*([\d.]+),\s*alpha:\s*([\d.]+)/

const getCosmicConfigPath = (homeDirectory: string): string =>
  path.join(homeDirectory, '.config', 'cosmic')

export const getCosmicModePath = (homeDirectory: string): string => path.join(
  getCosmicConfigPath(homeDirectory),
  'com.system76.CosmicTheme.Mode/v1/is_dark',
)

export const getCosmicThemePaths = (homeDirectory: string): string[] => {
  const configPath = getCosmicConfigPath(homeDirectory)
  return ['Dark', 'Light'].flatMap((mode) => [
    'background',
    'primary',
    'secondary',
    'accent',
    'destructive',
    'success',
    'warning',
  ].map((name) => path.join(
    configPath,
    `com.system76.CosmicTheme.${mode}/v1/${name}`,
  )))
}

const COSMIC_MODE_PATH = getCosmicModePath(homedir())
const COSMIC_THEME_PATHS = getCosmicThemePaths(homedir())

export const parseRonColor = (source: string | null, marker?: string): string | undefined => {
  if (source === null) return undefined
  const start = marker === undefined ? 0 : source.indexOf(`${marker}: (`)
  if (start < 0) return undefined
  const match = source.slice(start).match(RON_COLOR_PATTERN)
  return match === null
    ? undefined
    : `color(srgb ${match[1]} ${match[2]} ${match[3]} / ${match[4]})`
}

const readCosmicPalette = (): SystemThemePalette | null => {
  const configPath = getCosmicConfigPath(homedir())
  const mode = readText(COSMIC_MODE_PATH)?.trim() === 'true' ? 'Dark' : 'Light'
  const themePath = path.join(configPath, `com.system76.CosmicTheme.${mode}/v1`)
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

export const cosmicThemeProvider = {
  matches: (desktop: string) => desktop.includes('cosmic'),
  watchPaths: [COSMIC_MODE_PATH, ...COSMIC_THEME_PATHS],
  readPalette: readCosmicPalette,
} satisfies DesktopThemeProvider
