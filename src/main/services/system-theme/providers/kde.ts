import path from 'node:path'
import type { SystemThemePalette, ThemeProvider } from '../system-theme.types'
import { inferScheme, readText, subtleSidebarColor } from '../system-theme.utils'

export const getKdeThemePath = (homeDirectory: string): string =>
  path.join(homeDirectory, '.config', 'kdeglobals')

export const parseKdeColor = (value: string | undefined): string | undefined => {
  const channels = value?.split(',').slice(0, 3).map(Number)
  if (channels === undefined || channels.length !== 3 || !channels.every(Number.isFinite))
    return undefined
  return `rgb(${channels.join(' ')})`
}

const readKdePalette = (homeDirectory: string): SystemThemePalette | null => {
  const source = readText(getKdeThemePath(homeDirectory))
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

export const kdeThemeProvider = {
  id: 'kde',
  priority: 100,
  matches: ({ desktop }) => desktop.includes('kde') || desktop.includes('plasma'),
  watchPaths: ({ homeDirectory }) => [getKdeThemePath(homeDirectory)],
  read: ({ homeDirectory }) => {
    const palette = readKdePalette(homeDirectory)
    if (palette === null) return null
    const scheme = inferScheme(palette.background)
    return scheme === null ? { palette } : { scheme, palette }
  },
} satisfies ThemeProvider
