import { unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import { invalidationService } from '../invalidation'
import type { ISystemThemeService } from './system-theme.interface'
import { parsePortalAccent, parsePortalScheme, readPortalSetting } from './system-theme.portal'
import type {
  SystemTheme,
  SystemThemePalette,
  ThemeContribution,
  ThemeProvider,
  ThemeProviderContext,
  ThemeSource,
} from './system-theme.types'
import { inferScheme, normalizeThemeContribution, subtleSidebarColor } from './system-theme.utils'
import { desktopThemeProviders } from './providers'

const POLL_INTERVAL_MS = 5000
const WATCH_INTERVAL_MS = 1000

const makeProviderContext = (): ThemeProviderContext => ({
  desktop: process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? '',
  homeDirectory: homedir(),
})

const readDesktopTheme = async (
  context: ThemeProviderContext,
): Promise<{ contribution: ThemeContribution, provider: ThemeProvider } | null> => {
  for (const provider of desktopThemeProviders) {
    if (!provider.matches(context)) continue
    const detected = await provider.read(context)
    if (detected === null) continue
    const contribution = normalizeThemeContribution(detected)
    if (contribution !== null) return { contribution, provider }
  }
  return null
}

const portalAccentPalette = (accent: string): SystemThemePalette => ({
  primary: accent,
  accent,
  ring: accent,
  sidebarPrimary: subtleSidebarColor(accent),
  sidebarRing: accent,
})

export const detectTheme = async (
  context: ThemeProviderContext = makeProviderContext(),
): Promise<SystemTheme> => {
  const [schemeSource, accentSource] = await Promise.all([
    readPortalSetting('color-scheme'),
    readPortalSetting('accent-color'),
  ])
  const accent = parsePortalAccent(accentSource)
  const portalScheme = parsePortalScheme(schemeSource)
  const detectedDesktop = await readDesktopTheme(context)
  const desktopTheme = detectedDesktop?.contribution ?? null
  const palette = desktopTheme?.palette ?? null
  const mergedPalette = palette === null
    ? accent === null ? null : portalAccentPalette(accent)
    : accent === null ? palette : {
      ...portalAccentPalette(accent),
      ...palette,
    }

  const inferredScheme = inferScheme(palette?.background)
  const scheme = desktopTheme?.scheme ?? portalScheme ?? inferredScheme ?? 'dark'
  const providerSource = detectedDesktop?.provider.id
  let resolvedSchemeSource: ThemeSource = 'fallback'
  if (desktopTheme?.scheme !== undefined && providerSource !== undefined)
    resolvedSchemeSource = providerSource
  else if (portalScheme !== null)
    resolvedSchemeSource = 'xdg-portal'
  else if (inferredScheme !== null && providerSource !== undefined)
    resolvedSchemeSource = providerSource

  const resolvedPaletteSource: ThemeSource | null = palette !== null && providerSource !== undefined
    ? providerSource
    : accent === null ? null : 'xdg-portal'

  return {
    scheme,
    palette: mergedPalette,
    sources: {
      scheme: resolvedSchemeSource,
      palette: resolvedPaletteSource,
    },
  }
}

const providerContext = makeProviderContext()
const WATCH_PATHS = desktopThemeProviders
  .filter(provider => provider.matches(providerContext))
  .flatMap(provider => provider.watchPaths(providerContext))
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
