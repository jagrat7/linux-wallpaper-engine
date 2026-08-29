import { unwatchFile, watchFile } from 'node:fs'
import { invalidationService } from '../invalidation'
import type { ISystemThemeService } from './system-theme.interface'
import { parsePortalAccent, parsePortalScheme, readPortalSetting } from './system-theme.portal'
import type { SystemTheme } from './system-theme.types'
import { inferScheme, subtleSidebarColor } from './system-theme.utils'
import { desktopThemeProviders, pywalThemeProvider } from './providers'

const POLL_INTERVAL_MS = 5000
const WATCH_INTERVAL_MS = 1000

export const detectTheme = async (): Promise<SystemTheme> => {
  const [schemeSource, accentSource] = await Promise.all([
    readPortalSetting('color-scheme'),
    readPortalSetting('accent-color'),
  ])
  const accent = parsePortalAccent(accentSource)
  const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? ''
  const desktopThemeProvider = desktopThemeProviders.find(provider => provider.matches(desktop))
  const desktopTheme = desktopThemeProvider?.read() ?? null
  const palette = desktopTheme?.palette ?? pywalThemeProvider.read()?.palette ?? null
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
    scheme: desktopTheme?.scheme
      ?? parsePortalScheme(schemeSource)
      ?? inferScheme(palette?.background)
      ?? 'dark',
    palette: mergedPalette,
  }
}

const WATCH_PATHS = [
  ...desktopThemeProviders.flatMap(provider => provider.watchPaths),
  ...pywalThemeProvider.watchPaths,
]
let pollTimer: NodeJS.Timeout | null = null
let lastTheme = ''

export const refreshTheme = async (): Promise<SystemTheme> => {
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
} satisfies ISystemThemeService
