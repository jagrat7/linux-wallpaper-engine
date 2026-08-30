import { existsSync, readFileSync, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { hostExecAsync } from '../../utils/host'
import type { SystemThemePlatform } from './system-theme.interface'
import type {
  DesktopThemeProvider,
  SystemTheme,
  SystemThemePalette,
  ThemeScheme,
} from './system-theme.types'

type TimerHandle = ReturnType<typeof setTimeout>
type ElectronNativeTheme = typeof import('electron').nativeTheme
type ElectronSystemPreferences = typeof import('electron').systemPreferences
type ThemeRefreshCoordinatorOptions = {
  detect: () => Promise<SystemTheme>
  onChange: (theme: SystemTheme) => void
  onError?: (error: unknown) => void
  debounceMs: number
  setTimer?: (callback: () => void, delay: number) => TimerHandle
  clearTimer?: (timer: TimerHandle) => void
}

const PORTAL_DESTINATION = 'org.freedesktop.portal.Desktop'
const PORTAL_PATH = '/org/freedesktop/portal/desktop'
const PORTAL_INTERFACE = 'org.freedesktop.portal.Settings'
const PORTAL_NAMESPACE = 'org.freedesktop.appearance'

export const portal = {
  async readSetting(setting: string): Promise<string | null> {
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
  },

  parseScheme(source: string | null): ThemeScheme | null {
    const value = source?.match(/(?:uint32|\bu)\s+(\d+)/)?.[1]
    if (value === '1') return 'dark'
    if (value === '2') return 'light'
    return null
  },

  parseAccent(source: string | null): string | null {
    if (source === null) return null
    const tuple = source.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/)
      ?? source.match(/\(ddd\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    if (tuple !== null) {
      const channels = tuple.slice(1, 4).map(Number)
      return channels.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 1)
        ? `color(srgb ${channels.join(' ')})`
        : null
    }

    const values = Array.from(source.matchAll(/double\s+([\d.]+)/g))
      .slice(0, 3)
      .map(match => Number(match[1]))
    return values.length === 3
      && values.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 1)
      ? `color(srgb ${values.join(' ')})`
      : null
  },
}

export const electronTheme = {
  createPlatform(
    nativeTheme: ElectronNativeTheme,
    systemPreferences: ElectronSystemPreferences,
  ): SystemThemePlatform {
    return {
      readScheme: () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      subscribe(onChange) {
        nativeTheme.on('updated', onChange)
        systemPreferences.on('accent-color-changed', onChange)
        return () => {
          nativeTheme.off('updated', onChange)
          systemPreferences.off('accent-color-changed', onChange)
        }
      },
    }
  },
}

export const themeRefresh = {
  createCoordinator({
    detect,
    onChange,
    onError = () => {},
    debounceMs,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }: ThemeRefreshCoordinatorOptions) {
    let activeRefresh: Promise<SystemTheme> | null = null
    let trailingRefreshRequested = false
    let debounceTimer: TimerHandle | null = null
    let lastSuccessfulTheme: SystemTheme | null = null
    let lastSerializedTheme: string | null = null

    const runRefreshes = async (): Promise<SystemTheme> => {
      let result: SystemTheme | null = null
      let detectionError: unknown

      do {
        trailingRefreshRequested = false
        try {
          const theme = await detect()
          const serialized = JSON.stringify(theme)
          if (lastSerializedTheme !== null && serialized !== lastSerializedTheme)
            onChange(theme)
          lastSuccessfulTheme = theme
          lastSerializedTheme = serialized
          result = theme
          detectionError = undefined
        } catch (error) {
          onError(error)
          detectionError = error
          result = lastSuccessfulTheme
        }
      } while (trailingRefreshRequested)

      if (result !== null) return result
      throw detectionError
    }

    const refresh = (): Promise<SystemTheme> => {
      if (activeRefresh !== null) {
        trailingRefreshRequested = true
        return activeRefresh
      }
      activeRefresh = runRefreshes().finally(() => {
        activeRefresh = null
      })
      return activeRefresh
    }

    const requestRefresh = () => void refresh().catch(() => {})

    const cancelDebouncedRefresh = () => {
      if (debounceTimer === null) return
      clearTimer(debounceTimer)
      debounceTimer = null
    }

    const requestDebouncedRefresh = () => {
      cancelDebouncedRefresh()
      debounceTimer = setTimer(() => {
        debounceTimer = null
        requestRefresh()
      }, debounceMs)
    }

    return {
      refresh,
      requestRefresh,
      requestDebouncedRefresh,
      cancelDebouncedRefresh,
    }
  },
}

export const readText = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

export const watchThemeFiles = (
  filePaths: readonly string[],
  onChange: () => void,
  onError: (error: unknown) => void = () => {},
): FSWatcher[] => {
  const filesByDirectory = new Map<string, Set<string>>()
  filePaths.forEach((filePath) => {
    const directory = path.dirname(filePath)
    if (!existsSync(directory)) return
    const fileNames = filesByDirectory.get(directory) ?? new Set<string>()
    fileNames.add(path.basename(filePath))
    filesByDirectory.set(directory, fileNames)
  })

  const watchers: FSWatcher[] = []
  filesByDirectory.forEach((fileNames, directory) => {
    try {
      const watcher = watch(directory, (_, fileName) => {
        if (fileName === null || fileNames.has(fileName.toString())) onChange()
      })
      watcher.on('error', onError)
      watchers.push(watcher)
    } catch (error) {
      onError(error)
    }
  })
  return watchers
}

export const subtleSidebarColor = (
  accent: string | undefined,
  background?: string,
): string | undefined => accent === undefined
  ? undefined
  : `color-mix(in oklch, ${accent} 22%, ${background ?? 'var(--sidebar)'})`

export const inferScheme = (background: string | undefined): ThemeScheme | null => {
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

export const normalizeSystemThemePalette = (
  palette: SystemThemePalette | null,
): SystemThemePalette | null => {
  if (palette === null) return null
  const normalized = Object.fromEntries(Object.entries(palette).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].trim().length > 0,
  )) as SystemThemePalette
  return Object.keys(normalized).length === 0 ? null : normalized
}

export const detectSystemTheme = async (
  provider: DesktopThemeProvider | undefined,
  platformScheme: ThemeScheme | null = null,
): Promise<SystemTheme> => {
  const [schemeSource, accentSource] = await Promise.all([
    portal.readSetting('color-scheme'),
    portal.readSetting('accent-color'),
  ])
  const accent = portal.parseAccent(accentSource)
  const portalScheme = portal.parseScheme(schemeSource)
  const palette = normalizeSystemThemePalette(provider?.readPalette() ?? null)
  const portalPalette: SystemThemePalette | null = accent === null ? null : {
    primary: accent,
    accent,
    ring: accent,
    sidebarPrimary: subtleSidebarColor(accent),
    sidebarRing: accent,
  }
  const mergedPalette = palette === null
    ? portalPalette
    : portalPalette === null ? palette : { ...portalPalette, ...palette }

  return {
    scheme: portalScheme ?? platformScheme ?? inferScheme(palette?.background) ?? 'dark',
    palette: mergedPalette,
  }
}
