import { app, protocol, net, nativeImage, BrowserWindow, Tray, Menu } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'trpc-electron/main'
import { createTrpcContext } from './trpc/context.ts'
import { appRouter } from './trpc/router.ts'
import { settingsService as settings } from './services/settings.ts'
import { setFlatpakBypass } from './services/flatpak.ts'
import { setAutostart } from './services/autostart.ts'

// Global ref to tray to avoid GC
let tray: Tray | null = null
let isQuitting = false

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

// Initialize the system tray with context menu
const initializeTray = (mainWindow: BrowserWindow): void => {
  if (tray !== null) return
  tray = new Tray(appIcon)

  const toggleMainWindow = (): void => {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    } else if (!mainWindow.isFocused()) {
      mainWindow.focus()
    }
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle App',
      click: toggleMainWindow
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip(mainWindow.title)
  tray.setContextMenu(contextMenu)
  tray.on('click', toggleMainWindow)
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
    initializeTray(mainWindow)

  mainWindow.on('close', (e) => {
    if (shouldMinimizeOnClose() && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      if (tray === null)
        initializeTray(mainWindow)
    }
  })

  createIPCHandler({
    router: appRouter,
    windows: [mainWindow],
    createContext: async () => createTrpcContext(),
  })
})

// Dispose tray before quitting
app.on('before-quit', () => {
  isQuitting = true
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

