import { app, protocol, net, nativeImage, nativeTheme, systemPreferences, BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'trpc-electron/main'
import { createTrpcContext } from './trpc/context.ts'
import { appRouter } from './trpc/router.ts'
import { settingsService as settings } from './services/settings.ts'
import { setFlatpakBypass } from './utils/host.ts'
import { setAutostart } from './utils/autostart.ts'
import { resolveAssetPath } from './utils/assets.ts'
import { createAppTray, type AppTray } from './utils/tray.ts'
import { invalidationService } from './services/invalidation.ts'
import { systemThemeService } from './services/system-theme/system-theme.ts'
import { electronTheme } from './services/system-theme/system-theme.utils.ts'

// Global ref to tray to avoid GC
let appTray: AppTray | null = null
let isQuitting = false

systemThemeService.configurePlatform(electronTheme.createPlatform(nativeTheme, systemPreferences))

const appIcon = nativeImage.createFromPath(resolveAssetPath('transparent-logo.png'))

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

  appTray = createAppTray({ mainWindow, appIcon, isQuitting: () => isQuitting })

  if (settings.getSetting('enableSystemTray'))
    appTray.ensure()

  mainWindow.on('close', (e) => {
    if (shouldMinimizeOnClose() && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      appTray?.ensure()
    }
  })

  createIPCHandler({
    router: appRouter,
    windows: [mainWindow],
    createContext: async () => createTrpcContext(),
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
  appTray?.dispose()
  appTray = null
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
