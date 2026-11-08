import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { mockApp, mockAutoUpdater, mockEmit } = vi.hoisted(() => ({
  mockApp: { isPackaged: true, getVersion: vi.fn(() => '1.0.0') },
  mockAutoUpdater: {
    autoDownload: true,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
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

const feedVersion = (version: string) => ({ updateInfo: { version } })

describe('updaterService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()
    })

    it('reports no update when the feed has the running version', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(feedVersion('1.0.0'))
      const service = await loadService()

      await expect(service.check()).resolves.toEqual({ latestVersion: '1.0.0', hasUpdate: false })
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
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })
  })
})
