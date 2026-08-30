import type { FSWatcher } from 'node:fs'
import { invalidationService } from '../invalidation'
import type { ISystemThemeService, SystemThemePlatform } from './system-theme.interface'
import { detectSystemTheme, themeRefresh, watchThemeFiles } from './system-theme.utils'
import { desktopThemeProviders } from './providers'

const WATCH_DEBOUNCE_MS = 100
const provider = desktopThemeProviders.find(candidate => candidate.matches(
  process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? '',
))
let platform: SystemThemePlatform | null = null
let watching = false
let fileWatchers: FSWatcher[] = []
let stopPlatformWatching: (() => void) | null = null
const refreshCoordinator = themeRefresh.createCoordinator({
  detect: () => detectSystemTheme(provider, platform?.readScheme() ?? null),
  debounceMs: WATCH_DEBOUNCE_MS,
  onChange: () => invalidationService.emit('settings.systemTheme'),
  onError: error => console.warn('Failed to refresh system theme:', error),
})

export const systemThemeService = {
  configurePlatform(nextPlatform) {
    stopPlatformWatching?.()
    platform = nextPlatform
    stopPlatformWatching = watching
      ? platform.subscribe(refreshCoordinator.requestRefresh)
      : null
  },
  getTheme() {
    if (!watching) systemThemeService.startWatching()
    return refreshCoordinator.refresh()
  },
  startWatching() {
    if (watching) return
    watching = true
    stopPlatformWatching = platform?.subscribe(refreshCoordinator.requestRefresh) ?? null
    fileWatchers = watchThemeFiles(
      provider?.watchPaths ?? [],
      refreshCoordinator.requestDebouncedRefresh,
      error => console.warn('Failed to watch system theme:', error),
    )
  },
  stopWatching() {
    if (!watching) return
    watching = false
    stopPlatformWatching?.()
    stopPlatformWatching = null
    fileWatchers.forEach(watcher => watcher.close())
    fileWatchers = []
    refreshCoordinator.cancelDebouncedRefresh()
  },
} satisfies ISystemThemeService
