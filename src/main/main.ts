import { app, protocol, net, nativeImage, nativeTheme, systemPreferences, BrowserWindow, Tray, Menu, screen } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'trpc-electron/main'
import { createTrpcContext } from './trpc/context.ts'
import { appRouter } from './trpc/router.ts'
import { settingsService as settings } from './services/settings.ts'
import { setFlatpakBypass } from './utils/host.ts'
import { setAutostart } from './utils/autostart.ts'
import { createTrayStartupRetry, type TrayStartupRetry } from './utils/tray-startup.ts'
import { invalidationService } from './services/invalidation.ts'
import { systemThemeService } from './services/system-theme/system-theme.ts'
import { electronTheme } from './services/system-theme/system-theme.utils.ts'
import { wallpaperService } from './services/wallpaper/wallpaper.ts'
import { playlistService } from './services/playlists/playlist.ts'

// Global ref to tray to avoid GC
let tray: Tray | null = null
let trayStartupRetry: TrayStartupRetry | null = null
let isQuitting = false

systemThemeService.configurePlatform(electronTheme.createPlatform(nativeTheme, systemPreferences))

const resolveAssetPath = (assetName: string): string => {
  // If packaged normally in forge-maker
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'assets', assetName)

  // If packaged with Nix, the resource path will point to Electron's default,
  // so it needs to point to the app directory, where the assets are copied
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar'))
    return path.join(path.dirname(appPath), 'assets', assetName)

  // For local dev, relative paths just work
  return path.join(__dirname, '../../assets', assetName)
}

const appIcon = nativeImage.createFromPath(resolveAssetPath('transparent-logo.png'))
// Standard tray icon size (22x22 ensures pixmap data is sent via SNI on Wayland)
const TRAY_ICON_SIZE = 22
const trayIcon = appIcon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE })

const shouldMinimizeOnClose = (): boolean => {
  return settings.getSetting('enableSystemTray') && settings.getSetting('minimizeOnClose')
}

const shouldMinimizeOnStartup = (): boolean => {
  return settings.getSetting('enableSystemTray') && settings.getSetting('minimizeOnStartup')
}

// Register the local-file protocol for serving local wallpaper images
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (!shouldMinimizeOnStartup()) mainWindow.show()
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    )
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  return mainWindow
}

const toggleMainWindow = (mainWindow: BrowserWindow): void => {
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  } else if (!mainWindow.isFocused()) {
    mainWindow.focus()
  }
}

// Stop everything (wallpapers and playlists) from the tray
const stopAllWallpapers = async (): Promise<void> => {
  const result = await wallpaperService.stop()
  if (result.success) playlistService.clearActivePlaylist()
}

// Tray menu reflects live playback state; rebuilt whenever it changes.
// Pause/resume/stop work for playlists too — a playlist runs as the same
// tracked backend process, so freezing it halts rendering and rotation.
const buildTrayContextMenu = (mainWindow: BrowserWindow) => {
  const activeScreens = wallpaperService.getActiveScreens()
  const pausedScreens = wallpaperService.getPausedScreens()
  const hasActive = activeScreens.length > 0
  const hasPaused = pausedScreens.length > 0
  const hasUnpaused = activeScreens.some(screen => !pausedScreens.includes(screen))

  return Menu.buildFromTemplate([
    {
      label: 'Toggle App',
      click: () => toggleMainWindow(mainWindow)
    },
    { type: 'separator' },
    {
      label: 'Pause Wallpaper',
      enabled: hasUnpaused,
      click: () => { void wallpaperService.pause() }
    },
    {
      label: 'Resume Wallpaper',
      enabled: hasPaused,
      click: () => { void wallpaperService.resume() }
    },
    {
      label: 'Random Wallpaper',
      click: () => { void wallpaperService.applyRandom() }
    },
    {
      label: 'Stop Wallpaper',
      enabled: hasActive,
      click: () => { void stopAllWallpapers() }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])
}

const refreshTrayMenu = (mainWindow: BrowserWindow): void => {
  if (tray !== null) {
    tray.setContextMenu(buildTrayContextMenu(mainWindow))
  }
}

// Initialize the system tray with context menu
const initializeTray = (mainWindow: BrowserWindow): void => {
  if (tray !== null) return
  tray = new Tray(trayIcon)

  tray.setToolTip(mainWindow.title)
  tray.setContextMenu(buildTrayContextMenu(mainWindow))
  tray.on('click', () => toggleMainWindow(mainWindow))
}

const ensureTray = (mainWindow: BrowserWindow): void => {
  if (trayStartupRetry === null) {
    trayStartupRetry = createTrayStartupRetry({
      createTray: () => initializeTray(mainWindow),
      hasTray: () => tray !== null,
      shouldStop: () => isQuitting,
    })
  }

  trayStartupRetry.start()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Sync flatpak bypass from saved settings
  setFlatpakBypass(settings.getSetting('flatpakBypass'))

  // Write / delete autostart file from saved settings
  setAutostart(settings.getSetting('launchOnLogin'))

  // Register protocol handler for local files
  protocol.handle('local-file', (request) => {
    // URL format: local-file:///path/to/file
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch(`file://${filePath}`)
  })

  const mainWindow = createWindow()

  if (settings.getSetting('enableSystemTray'))
    ensureTray(mainWindow)

  mainWindow.on('close', (e) => {
    if (shouldMinimizeOnClose() && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      if (tray === null)
        ensureTray(mainWindow)
    }
  })

  createIPCHandler({
    router: appRouter,
    windows: [mainWindow],
    createContext: async () => createTrpcContext(),
  })

  // Keep the tray menu in sync with playback state (apply/stop/pause/resume)
  invalidationService.subscribe((key) => {
    if (
      key === 'wallpaper.applied' ||
      key === 'wallpaper.stopped' ||
      key === 'wallpaper.paused' ||
      key === 'wallpaper.resumed'
    ) {
      refreshTrayMenu(mainWindow)
    }
  })

  // Push a display.list invalidation to the renderer whenever monitors
  // are added, removed, or change resolution so apply menus stay accurate
  const notifyDisplayChange = () => invalidationService.emit('display.list')
  screen.on('display-added', notifyDisplayChange)
  screen.on('display-removed', notifyDisplayChange)
  screen.on('display-metrics-changed', notifyDisplayChange)
})

// Dispose tray before quitting
app.on('before-quit', () => {
  systemThemeService.stopWatching()
  isQuitting = true
  if (trayStartupRetry !== null) {
    trayStartupRetry.stop()
    trayStartupRetry = null
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !shouldMinimizeOnClose()) {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
