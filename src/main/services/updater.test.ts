import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { mockApp, mockAutoUpdater, mockEmit } = vi.hoisted(() => ({
  mockApp: {
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0'),
    releaseSingleInstanceLock: vi.fn(),
    requestSingleInstanceLock: vi.fn(),
  },
  mockAutoUpdater: {
    autoDownload: true,
    allowPrerelease: true,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    // Enough of an EventEmitter for install() to hear one 'error'
    listeners: new Map<string, (error: Error) => void>(),
    once(event: string, listener: (error: Error) => void) {
      this.listeners.set(event, listener)
    },
    off(event: string) {
      this.listeners.delete(event)
    },
  },
  mockEmit: vi.fn(),
}))

vi.mock('electron', () => ({ app: mockApp }))
vi.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }))
vi.mock('./invalidation', () => ({ invalidationService: { emit: mockEmit } }))

// The service is a singleton, so each test loads a fresh copy
const loadService = async () => {
  vi.resetModules()
  return (await import('./updater')).updaterService
}

// electron-updater decides isUpdateAvailable with full semver against the running version
const feedVersion = (version: string, isUpdateAvailable = version !== '1.0.0') => ({
  updateInfo: { version },
  isUpdateAvailable,
})

describe('updaterService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAutoUpdater.quitAndInstall.mockReset()
    mockAutoUpdater.listeners.clear()
    mockApp.getVersion.mockReturnValue('1.0.0')
    mockApp.isPackaged = true
    vi.stubEnv('APPIMAGE', '/home/user/Applications/app.AppImage')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('canAutoUpdate', () => {
    it('is true for a packaged AppImage', async () => {
      expect((await loadService()).canAutoUpdate).toBe(true)
    })

    it('is false outside an AppImage, such as a deb or AUR install', async () => {
      vi.stubEnv('APPIMAGE', '')
      expect((await loadService()).canAutoUpdate).toBe(false)
    })

    it('is false in development', async () => {
      mockApp.isPackaged = false
      expect((await loadService()).canAutoUpdate).toBe(false)
    })
  })

  describe('check', () => {
    it('reports a newer feed version without downloading it', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.2.0'))
      const service = await loadService()

      await expect(service.check()).resolves.toEqual({ latestVersion: '1.2.0', hasUpdate: true })
      expect(mockAutoUpdater.autoDownload).toBe(false)
      expect(mockAutoUpdater.allowPrerelease).toBe(false)
      expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()
    })

    it('reports no update when the feed has the running version', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.0.0'))
      const service = await loadService()

      await expect(service.check()).resolves.toEqual({ latestVersion: '1.0.0', hasUpdate: false })
    })

    it("takes electron-updater's semver verdict, which ranks 1.0.0 above 1.0.0-beta.1", async () => {
      mockApp.getVersion.mockReturnValue('1.0.0-beta.1')
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.0.0', true))
      const service = await loadService()

      await expect(service.check()).resolves.toEqual({ latestVersion: '1.0.0', hasUpdate: true })
    })
  })

  describe('download', () => {
    it('moves from downloading to ready and tells the renderer each time', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.2.0'))
      const service = await loadService()
      let statusDuringDownload: unknown
      mockAutoUpdater.downloadUpdate.mockImplementation(async () => {
        statusDuringDownload = service.getStatus()
      })

      await service.download()

      expect(statusDuringDownload).toEqual({ state: 'downloading', version: '1.2.0' })
      expect(service.getStatus()).toEqual({ state: 'ready', version: '1.2.0' })
      expect(mockEmit).toHaveBeenCalledTimes(2)
      expect(mockEmit).toHaveBeenCalledWith('app.updateStatus')
    })

    it('reports a failed download so the banner can offer a retry', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.2.0'))
      mockAutoUpdater.downloadUpdate.mockRejectedValue(new Error('network down'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const service = await loadService()

      await service.download()

      expect(service.getStatus()).toEqual({ state: 'failed', version: '1.2.0' })
    })

    it('does nothing outside an AppImage', async () => {
      vi.stubEnv('APPIMAGE', '')
      const service = await loadService()

      await service.download()

      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(service.getStatus()).toEqual({ state: 'idle', version: null })
    })
  })

  describe('install', () => {
    it('only quits and installs once the download is ready', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.2.0'))
      mockAutoUpdater.downloadUpdate.mockResolvedValue([])
      const service = await loadService()

      service.install()
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled()

      await service.download()
      service.install()
      expect(mockApp.releaseSingleInstanceLock).toHaveBeenCalled()
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('reports a failed install, such as an unwritable folder, and keeps the app running', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.2.0'))
      mockAutoUpdater.downloadUpdate.mockResolvedValue([])
      mockAutoUpdater.quitAndInstall.mockImplementation(() => {
        mockAutoUpdater.listeners.get('error')?.(new Error('EACCES'))
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const service = await loadService()
      await service.download()

      service.install()

      expect(service.getStatus()).toEqual({ state: 'failed', version: '1.2.0' })
      expect(mockApp.requestSingleInstanceLock).toHaveBeenCalled()
      expect(mockAutoUpdater.listeners.size).toBe(0)
    })
  })
})
