import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  Tray,
  type NativeImage,
} from 'electron'
import { invalidationService } from '../services/invalidation'
import { playlistService } from '../services/playlists/playlist'
import { wallpaperService } from '../services/wallpaper/wallpaper'
import { APP_NAME } from '../../shared/constants/app'
import { resolveAssetPath } from './assets'
import { createTrayStartupRetry, type TrayStartupRetry } from './tray-startup'

export interface AppTray {
  /** Create the tray (with the StatusNotifier startup retry). No-op if it already exists. */
  ensure: () => void
  /** Rebuild the context menu from current playback state / theme. No-op without a tray. */
  refreshMenu: () => void
  /** Stop any pending startup retry and destroy the tray. */
  dispose: () => void
}

interface AppTrayOptions {
  mainWindow: BrowserWindow
  appIcon: NativeImage
  isQuitting: () => boolean
}

// Standard tray icon size (22x22 ensures pixmap data is sent via SNI on Wayland)
const TRAY_ICON_SIZE = 22

// Menu icons follow the system theme so they stay legible on the bar's menu background
const trayMenuIcon = (name: string) =>
  nativeImage.createFromPath(
    resolveAssetPath(`tray/${nativeTheme.shouldUseDarkColors ? 'dark' : 'light'}/${name}.png`),
  )

// Tray actions have no other feedback surface — report failures as a desktop
// notification so they aren't silent no-ops
const notifyFailure = (error: string | undefined, fallback: string): void => {
  new Notification({ title: APP_NAME, body: error ?? fallback }).show()
}

// Stop everything (wallpapers and playlists) from the tray
const stopAllWallpapers = async (): Promise<void> => {
  const result = await wallpaperService.stop()
  if (result.success) playlistService.clearActivePlaylist()
}

/**
 * Owns the system tray: the tray icon, the live context menu
 * (pause/resume/random/stop), the StatusNotifier startup retry, and the
 * theme- and playback-state-driven menu refreshes.
 */
export const createAppTray = ({ mainWindow, appIcon, isQuitting }: AppTrayOptions): AppTray => {
  let tray: Tray | null = null
  let trayStartupRetry: TrayStartupRetry | null = null
  const trayIcon = appIcon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE })

  const toggleMainWindow = (): void => {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    } else if (!mainWindow.isFocused()) {
      mainWindow.focus()
    }
  }

  // Tray menu reflects live playback state; rebuilt whenever it changes.
  // Pause/resume/stop work for playlists too — a playlist runs as the same
  // tracked backend process, so freezing it halts rendering and rotation.
  const buildTrayContextMenu = () => {
    const activeScreens = wallpaperService.getActiveScreens()
    const pausedScreens = wallpaperService.getPausedScreens()
    const hasActive = activeScreens.length > 0
    const hasPaused = pausedScreens.length > 0
    const hasUnpaused = activeScreens.some((screen) => !pausedScreens.includes(screen))

    return Menu.buildFromTemplate([
      {
        label: 'Toggle App',
        icon: trayMenuIcon('toggle-app'),
        click: () => toggleMainWindow(),
      },
      { type: 'separator' },
      {
        label: 'Pause Wallpaper',
        icon: trayMenuIcon('pause'),
        enabled: hasUnpaused,
        click: async () => {
          const result = await wallpaperService.pause()
          if (!result.success) notifyFailure(result.error, 'Failed to pause wallpapers')
        },
      },
      {
        label: 'Resume Wallpaper',
        icon: trayMenuIcon('play'),
        enabled: hasPaused,
        click: async () => {
          const result = await wallpaperService.resume()
          if (!result.success) notifyFailure(result.error, 'Failed to resume wallpapers')
        },
      },
      {
        label: 'Random Wallpaper',
        icon: trayMenuIcon('shuffle'),
        click: async () => {
          const result = await wallpaperService.applyRandom()
          if (!result.success) notifyFailure(result.error, 'Failed to apply a random wallpaper')
        },
      },
      {
        label: 'Stop Wallpaper',
        icon: trayMenuIcon('stop'),
        enabled: hasActive,
        click: () => {
          void stopAllWallpapers()
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        icon: trayMenuIcon('quit'),
        click: () => {
          app.quit()
        },
      },
    ])
  }

  const refreshMenu = (): void => {
    if (tray !== null) {
      tray.setContextMenu(buildTrayContextMenu())
    }
  }

  // Initialize the system tray with context menu
  const initializeTray = (): void => {
    if (tray !== null) return
    tray = new Tray(trayIcon)

    tray.setToolTip(mainWindow.title)
    tray.setContextMenu(buildTrayContextMenu())
    tray.on('click', () => toggleMainWindow())
  }

  const ensure = (): void => {
    if (trayStartupRetry === null) {
      trayStartupRetry = createTrayStartupRetry({
        createTray: initializeTray,
        hasTray: () => tray !== null,
        shouldStop: isQuitting,
      })
    }

    trayStartupRetry.start()
  }

  // Keep the tray menu in sync with playback state (apply/stop/pause/resume)
  const unsubscribeInvalidation = invalidationService.subscribe((key) => {
    if (
      key === 'wallpaper.applied' ||
      key === 'wallpaper.stopped' ||
      key === 'wallpaper.paused' ||
      key === 'wallpaper.resumed'
    ) {
      refreshMenu()
    }
  })

  // Swap menu icon variants when the system theme flips between dark and light
  const handleThemeUpdated = () => refreshMenu()
  nativeTheme.on('updated', handleThemeUpdated)

  const dispose = (): void => {
    unsubscribeInvalidation()
    nativeTheme.off('updated', handleThemeUpdated)
    if (trayStartupRetry !== null) {
      trayStartupRetry.stop()
      trayStartupRetry = null
    }
    if (tray) {
      tray.destroy()
      tray = null
    }
  }

  return { ensure, refreshMenu, dispose }
}
