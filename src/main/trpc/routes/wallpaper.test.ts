import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Wallpaper, WallpaperOverrides } from '../../../shared/constants/wallpaper'

// --- Mocks ---------------------------------------------------------------

const { mockWallpaperService, mockSettingsService, mockCompatibilityInstance } = vi.hoisted(() => ({
  mockWallpaperService: {
    query: vi.fn(),
    apply: vi.fn(),
    stop: vi.fn(),
    overrides: vi.fn(),
    diagnose: vi.fn(),
  },
  mockSettingsService: {
    loadSettings: vi.fn(),
  },
  mockCompatibilityInstance: {
    setCompatibility: vi.fn(),
    getCompatibilityMap: vi.fn(),
    scanAll: vi.fn(),
    getScanProgress: vi.fn(),
    getScanReport: vi.fn(),
    abortScan: vi.fn(),
  },
}))

vi.mock('../../services/wallpaper/wallpaper', () => ({
  wallpaperService: mockWallpaperService,
}))

vi.mock('../../services/settings', () => ({
  settingsService: mockSettingsService,
}))

vi.mock('../../services/compatibility', () => ({
  CompatibilityService: {
    getInstance: () => mockCompatibilityInstance,
  },
}))

// Import router after mocks
import { wallpaperRouter } from './wallpaper'
import { trpc } from '../trpc'

// --- Helpers -------------------------------------------------------------

const caller = trpc.createCallerFactory(wallpaperRouter)({ senderId: undefined })

const makeWallpaper = (overrides: Partial<Wallpaper> = {}): Wallpaper => ({
  id: '123',
  title: 'Test Wallpaper',
  author: 'Test Author',
  ageRating: 'g',
  type: 'scene',
  thumbnail: '/path/thumb.jpg',
  resolution: { width: 1920, height: 1080 },
  fileSize: 1024,
  dateAdded: Date.now(),
  tags: [],
  installed: true,
  path: '/path/to/wallpaper',
  ...overrides,
})

// --- Tests ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('wallpaperRouter', () => {
  describe('checkBackend', () => {
    it('should return installed true when backend is installed', async () => {
      mockWallpaperService.query.mockResolvedValue({ wallpapers: [], backendInstalled: true, active: [] })
      const result = await caller.checkBackend()
      expect(result).toEqual({ installed: true })
    })

    it('should return installed false when backend is missing', async () => {
      mockWallpaperService.query.mockResolvedValue({ wallpapers: [], backendInstalled: false, active: [] })
      const result = await caller.checkBackend()
      expect(result).toEqual({ installed: false })
    })
  })

  describe('getWallpapers', () => {
    it('should pass search input to service', async () => {
      const wallpapers = [makeWallpaper()]
      mockWallpaperService.query.mockResolvedValue({ wallpapers, backendInstalled: true, active: [] })

      const result = await caller.getWallpapers({ search: 'anime' })

      expect(mockWallpaperService.query).toHaveBeenCalledWith({ search: 'anime' })
      expect(result).toEqual(wallpapers)
    })

    it('should work without search input', async () => {
      mockWallpaperService.query.mockResolvedValue({ wallpapers: [], backendInstalled: true, active: [] })
      const result = await caller.getWallpapers({})
      expect(result).toEqual([])
    })
  })

  describe('invalidateCache', () => {
    it('should call invalidateCache and return success', async () => {
      mockWallpaperService.diagnose.mockResolvedValue(undefined)
      const result = await caller.invalidateCache()
      expect(mockWallpaperService.diagnose).toHaveBeenCalledWith({ kind: 'invalidateCache' })
      expect(result).toEqual({ success: true })
    })
  })

  describe('getOverrides', () => {
    it('should return overrides for the given path', async () => {
      const overrides: WallpaperOverrides = { volume: 50, scaling: 'fill' }
      mockWallpaperService.overrides.mockResolvedValue(overrides)

      const result = await caller.getOverrides({ path: '/path/to/wp' })

      expect(mockWallpaperService.overrides).toHaveBeenCalledWith({ op: 'get', wallpaperPath: '/path/to/wp' })
      expect(result).toEqual(overrides)
    })
  })

  describe('setWallpaper', () => {
    it('should merge input with saved settings using nullish coalescing', async () => {
      mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
      mockWallpaperService.apply.mockResolvedValue({ success: true })

      await caller.setWallpaper({ backgroundId: '12345' })

      expect(mockWallpaperService.apply).toHaveBeenCalledWith({
        kind: 'wallpaper',
        options: {
          backgroundId: '12345',
          screen: undefined,
          scaling: DEFAULT_SETTINGS.defaultScaling,
          fps: DEFAULT_SETTINGS.fps,
          volume: DEFAULT_SETTINGS.volume,
          silent: DEFAULT_SETTINGS.silent,
          noAutomute: DEFAULT_SETTINGS.noAutomute,
          noAudioProcessing: !DEFAULT_SETTINGS.audioProcessing,
          disableMouse: DEFAULT_SETTINGS.disableMouse,
          disableParallax: DEFAULT_SETTINGS.disableParallax,
          noFullscreenPause: !DEFAULT_SETTINGS.pauseOnFullscreen,
          windowed: undefined,
        },
      })
    })

    it('should let explicit input override saved settings', async () => {
      mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
      mockWallpaperService.apply.mockResolvedValue({ success: true })

      await caller.setWallpaper({
        backgroundId: '99',
        fps: 144,
        volume: 30,
        silent: true,
        scaling: 'stretch',
        screen: 'eDP-1',
      })

      const call = mockWallpaperService.apply.mock.calls[0][0]
      expect(call.options.fps).toBe(144)
      expect(call.options.volume).toBe(30)
      expect(call.options.silent).toBe(true)
      expect(call.options.scaling).toBe('stretch')
      expect(call.options.screen).toBe('eDP-1')
    })

    it('should invert audioProcessing and pauseOnFullscreen from settings', async () => {
      mockSettingsService.loadSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        audioProcessing: false,
        pauseOnFullscreen: false,
      })
      mockWallpaperService.apply.mockResolvedValue({ success: true })

      await caller.setWallpaper({ backgroundId: '1' })

      const call = mockWallpaperService.apply.mock.calls[0][0]
      expect(call.options.noAudioProcessing).toBe(true)
      expect(call.options.noFullscreenPause).toBe(true)
    })

    it('should pass windowed option through when provided', async () => {
      mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
      mockWallpaperService.apply.mockResolvedValue({ success: true })

      const windowed = { x: 0, y: 0, width: 800, height: 600 }
      await caller.setWallpaper({ backgroundId: '1', windowed })

      const call = mockWallpaperService.apply.mock.calls[0][0]
      expect(call.options.windowed).toEqual(windowed)
    })

    it('should return the service response', async () => {
      mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
      mockWallpaperService.apply.mockResolvedValue({ success: false, error: 'spawn failed' })

      const result = await caller.setWallpaper({ backgroundId: '1' })
      expect(result).toEqual({ success: false, error: 'spawn failed' })
    })
  })

  describe('stopWalpaper', () => {
    it('should stop a specific screen', async () => {
      mockWallpaperService.stop.mockResolvedValue({ success: true })
      const result = await caller.stopWalpaper({ screen: 'HDMI-1' })
      expect(mockWallpaperService.stop).toHaveBeenCalledWith('HDMI-1')
      expect(result).toEqual({ success: true })
    })

    it('should stop all when no screen given', async () => {
      mockWallpaperService.stop.mockResolvedValue({ success: true })
      const result = await caller.stopWalpaper()
      expect(mockWallpaperService.stop).toHaveBeenCalledWith(undefined)
      expect(result).toEqual({ success: true })
    })
  })

  describe('screenshot', () => {
    it('should pass paths to the service', async () => {
      mockWallpaperService.diagnose.mockResolvedValue({ success: true, path: '/out.png' })

      const result = await caller.screenshot({
        backgroundPath: '/wp/123',
        outputPath: '/out.png',
      })

      expect(mockWallpaperService.diagnose).toHaveBeenCalledWith({
        kind: 'screenshot',
        backgroundPath: '/wp/123',
        outputPath: '/out.png',
      })
      expect(result).toEqual({ success: true, path: '/out.png' })
    })
  })

  describe('getActiveWallpaper', () => {
    it('should return active wallpapers with titles', async () => {
      const active = [{ screen: 'eDP-1', wallpaper: '123', title: 'Cool', thumbnail: '/t.jpg' }]
      mockWallpaperService.query.mockResolvedValue({ wallpapers: [], backendInstalled: true, active })

      const result = await caller.getActiveWallpaper()
      expect(result).toEqual(active)
    })
  })

  describe('saveOverrides', () => {
    it('should save overrides and return success', async () => {
      mockWallpaperService.overrides.mockResolvedValue(undefined)

      const overrides: WallpaperOverrides = { volume: 75, scaling: 'fit' }
      const result = await caller.saveOverrides({ path: '/wp/1', overrides })

      expect(mockWallpaperService.overrides).toHaveBeenCalledWith({ op: 'save', wallpaperPath: '/wp/1', overrides })
      expect(result).toEqual({ success: true })
    })
  })

  describe('resetOverrides', () => {
    it('should reset overrides and return success', async () => {
      mockWallpaperService.overrides.mockResolvedValue(undefined)
      const result = await caller.resetOverrides({ path: '/wp/1' })
      expect(mockWallpaperService.overrides).toHaveBeenCalledWith({ op: 'reset', wallpaperPath: '/wp/1' })
      expect(result).toEqual({ success: true })
    })
  })

  describe('setCompatibility', () => {
    it('should set compatibility status', async () => {
      const result = await caller.setCompatibility({ path: '/wp/1', status: 'broken' })
      expect(mockCompatibilityInstance.setCompatibility).toHaveBeenCalledWith('/wp/1', 'broken')
      expect(result).toEqual({ success: true })
    })
  })

  describe('getCompatibilityMap', () => {
    it('should return the compatibility map', async () => {
      const map = { '/wp/1': 'perfect', '/wp/2': 'broken' }
      mockCompatibilityInstance.getCompatibilityMap.mockReturnValue(map)

      const result = await caller.getCompatibilityMap()
      expect(result).toEqual(map)
    })
  })

  describe('scanAll', () => {
    it('should fetch wallpapers then delegate to compatibility scan', async () => {
      const wallpapers = [makeWallpaper(), makeWallpaper({ id: '456' })]
      mockWallpaperService.query.mockResolvedValue({ wallpapers, backendInstalled: true, active: [] })
      mockCompatibilityInstance.scanAll.mockResolvedValue({ total: 2, scanned: 2 })

      const result = await caller.scanAll()

      expect(mockWallpaperService.query).toHaveBeenCalled()
      expect(mockCompatibilityInstance.scanAll).toHaveBeenCalledWith(wallpapers)
      expect(result).toEqual({ total: 2, scanned: 2 })
    })
  })

  describe('getScanProgress', () => {
    it('should return scan progress', async () => {
      const progress = { running: true, current: '/wp/1', total: 10, scanned: 3, aborted: false }
      mockCompatibilityInstance.getScanProgress.mockReturnValue(progress)

      const result = await caller.getScanProgress()
      expect(result).toEqual(progress)
    })
  })

  describe('getScanReport', () => {
    it('should join scan report with wallpaper titles', async () => {
      const report = [
        { path: '/wp/1', status: 'perfect', errors: [], lastTested: 100 },
        { path: '/wp/2', status: 'broken', errors: ['segfault'], lastTested: 200 },
      ]
      const wallpapers = [
        makeWallpaper({ path: '/wp/1', title: 'Forest' }),
        makeWallpaper({ path: '/wp/2', title: 'Ocean' }),
      ]
      mockCompatibilityInstance.getScanReport.mockReturnValue(report)
      mockWallpaperService.query.mockResolvedValue({ wallpapers, backendInstalled: true, active: [] })

      const result = await caller.getScanReport()

      expect(result[0].title).toBe('Forest')
      expect(result[1].title).toBe('Ocean')
    })

    it('should fallback to folder name when title not found', async () => {
      const report = [{ path: '/some/missing/wallpaper', status: 'unknown', errors: [], lastTested: 0 }]
      mockCompatibilityInstance.getScanReport.mockReturnValue(report)
      mockWallpaperService.query.mockResolvedValue({ wallpapers: [], backendInstalled: true, active: [] })

      const result = await caller.getScanReport()

      expect(result[0].title).toBe('wallpaper')
    })
  })

  describe('abortScan', () => {
    it('should abort and return success', async () => {
      const result = await caller.abortScan()
      expect(mockCompatibilityInstance.abortScan).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('getDebugLogs', () => {
    it('should return debug logs for a screen', async () => {
      const logs = { command: 'linux-wallpaperengine --screen eDP-1', logs: ['frame 1', 'frame 2'] }
      mockWallpaperService.diagnose.mockResolvedValue(logs)

      const result = await caller.getDebugLogs({ screen: 'eDP-1' })
      expect(mockWallpaperService.diagnose).toHaveBeenCalledWith({ kind: 'getLogs', screen: 'eDP-1' })
      expect(result).toEqual(logs)
    })
  })

  describe('clearDebugLogs', () => {
    it('should clear logs and return success', async () => {
      mockWallpaperService.diagnose.mockResolvedValue(undefined)
      const result = await caller.clearDebugLogs({ screen: 'eDP-1' })
      expect(mockWallpaperService.diagnose).toHaveBeenCalledWith({ kind: 'clearLogs', screen: 'eDP-1' })
      expect(result).toEqual({ success: true })
    })
  })
})
