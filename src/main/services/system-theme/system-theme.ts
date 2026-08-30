import { unwatchFile, watchFile } from 'node:fs'
import { invalidationService } from '../invalidation'
import type { ISystemThemeService } from './system-theme.interface'
import { parsePortalAccent, parsePortalScheme, readPortalSetting } from './system-theme.portal'
import type {
  SystemTheme,
  SystemThemePalette,
} from './system-theme.types'
import { inferScheme, normalizeSystemThemePalette, subtleSidebarColor } from './system-theme.utils'
import { desktopThemeProviders } from './providers'

const POLL_INTERVAL_MS = 5000
const WATCH_INTERVAL_MS = 1000

const currentDesktop = (): string => process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? ''

const portalAccentPalette = (accent: string): SystemThemePalette => ({
  primary: accent,
  accent,
  ring: accent,
  sidebarPrimary: subtleSidebarColor(accent),
  sidebarRing: accent,
})

export const detectTheme = async (
  desktop: string = currentDesktop(),
): Promise<SystemTheme> => {
  const [schemeSource, accentSource] = await Promise.all([
    readPortalSetting('color-scheme'),
    readPortalSetting('accent-color'),
  ])
  const accent = parsePortalAccent(accentSource)
  const portalScheme = parsePortalScheme(schemeSource)
  const provider = desktopThemeProviders.find(candidate => candidate.matches(desktop))
  const palette = normalizeSystemThemePalette(provider?.readPalette() ?? null)
  const mergedPalette = palette === null
    ? accent === null ? null : portalAccentPalette(accent)
    : accent === null ? palette : {
      ...portalAccentPalette(accent),
      ...palette,
    }

  return {
    scheme: portalScheme ?? inferScheme(palette?.background) ?? 'dark',
    palette: mergedPalette,
  }
}

const WATCH_PATHS = desktopThemeProviders
  .find(provider => provider.matches(currentDesktop()))
  ?.watchPaths ?? []
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
