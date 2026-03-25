import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, type AppSettings } from '../../../shared/constants'

// --- Mocks ---------------------------------------------------------------

const {
  mockSettingsService, mockWallpaperService,
  mockIsFlatpak, mockSetFlatpakBypass, mockSetAutostart,
} = vi.hoisted(() => ({
  mockSettingsService: {
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    getDefaultSettings: vi.fn(),
  },
  mockWallpaperService: {
    reapplyActiveWallpapers: vi.fn(),
  },
  mockIsFlatpak: vi.fn(),
  mockSetFlatpakBypass: vi.fn(),
  mockSetAutostart: vi.fn(),
}))

vi.mock('../../services/settings', () => ({
  settingsService: mockSettingsService,
}))

vi.mock('../../services/wallpaper/wallpaper', () => ({
  wallpaperService: mockWallpaperService,
}))

vi.mock('../../services/flatpak', () => ({
  isFlatpak: (...args: unknown[]) => mockIsFlatpak(...args),
  setFlatpakBypass: (...args: unknown[]) => mockSetFlatpakBypass(...args),
}))

vi.mock('../../services/autostart', () => ({
  setAutostart: (...args: unknown[]) => mockSetAutostart(...args),
}))

// Import router after mocks
import { settingsRouter } from './settings'
import { trpc } from '../trpc'

// --- Helpers -------------------------------------------------------------

const caller = trpc.createCallerFactory(settingsRouter)({ senderId: undefined })

const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
})

// --- Tests ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settingsRouter', () => {
  describe('get', () => {
    it('should return current settings', async () => {
      const settings = makeSettings({ fps: 144, theme: 'dark' })
      mockSettingsService.loadSettings.mockResolvedValue(settings)

      const result = await caller.get()

      expect(mockSettingsService.loadSettings).toHaveBeenCalled()
      expect(result).toEqual(settings)
    })
  })

  describe('update', () => {
    it('should save settings and return updated state', async () => {
      const updated = makeSettings({ fps: 120 })
      mockSettingsService.saveSettings.mockResolvedValue(updated)
      mockWallpaperService.reapplyActiveWallpapers.mockResolvedValue(undefined)

      const result = await caller.update({ fps: 120 })

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith({ fps: 120 })
      expect(result).toEqual(updated)
    })

    describe('backend key reapply', () => {
      const BACKEND_KEYS = [
        'fps', 'pauseOnFullscreen', 'volume', 'silent', 'noAutomute',
        'audioProcessing', 'defaultScaling', 'disableMouse', 'disableParallax', 'assetsDir',
      ] as const

      it.each(BACKEND_KEYS)('should reapply wallpapers when %s changes', async (key) => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())
        mockWallpaperService.reapplyActiveWallpapers.mockResolvedValue(undefined)

        const input: Record<string, unknown> = {}
        // Set a valid value for each key type
        if (key === 'defaultScaling') {
          input[key] = 'stretch'
        } else if (key === 'assetsDir') {
          input[key] = '/custom/assets'
        } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          input[key] = !DEFAULT_SETTINGS[key]
        } else {
          input[key] = 90
        }

        await caller.update(input as never)

        expect(mockWallpaperService.reapplyActiveWallpapers).toHaveBeenCalled()
      })

      const NON_BACKEND_KEYS = ['theme', 'launchOnLogin', 'enableSystemTray', 'minimizeOnClose'] as const

      it.each(NON_BACKEND_KEYS)('should NOT reapply wallpapers when %s changes', async (key) => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())

        const input: Record<string, unknown> = {}
        if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          input[key] = !DEFAULT_SETTINGS[key]
        } else {
          input[key] = 'dark'
        }

        await caller.update(input as never)

        expect(mockWallpaperService.reapplyActiveWallpapers).not.toHaveBeenCalled()
      })
    })

    describe('side effects', () => {
      it('should call setFlatpakBypass when flatpakBypass is updated', async () => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())

        await caller.update({ flatpakBypass: true })

        expect(mockSetFlatpakBypass).toHaveBeenCalledWith(true)
      })

      it('should NOT call setFlatpakBypass when flatpakBypass is not in input', async () => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())

        await caller.update({ theme: 'dark' })

        expect(mockSetFlatpakBypass).not.toHaveBeenCalled()
      })

      it('should call setAutostart when launchOnLogin is updated', async () => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())

        await caller.update({ launchOnLogin: true })

        expect(mockSetAutostart).toHaveBeenCalledWith(true)
      })

      it('should NOT call setAutostart when launchOnLogin is not in input', async () => {
        mockSettingsService.saveSettings.mockResolvedValue(makeSettings())

        await caller.update({ fps: 90 })

        expect(mockSetAutostart).not.toHaveBeenCalled()
      })
    })
  })

  describe('reset', () => {
    it('should reset settings and reapply wallpapers', async () => {
      const current = makeSettings({ onboardingComplete: true, dismissedScanReminder: true, fps: 144 })
      const resetResult = makeSettings()
      mockSettingsService.loadSettings.mockResolvedValue(current)
      mockSettingsService.resetSettings.mockResolvedValue(resetResult)
      mockSettingsService.saveSettings.mockResolvedValue(resetResult)
      mockWallpaperService.reapplyActiveWallpapers.mockResolvedValue(undefined)

      await caller.reset()

      expect(mockSettingsService.resetSettings).toHaveBeenCalled()
      expect(mockWallpaperService.reapplyActiveWallpapers).toHaveBeenCalled()
    })

    it('should preserve onboardingComplete after reset', async () => {
      const current = makeSettings({ onboardingComplete: true, dismissedScanReminder: false })
      mockSettingsService.loadSettings.mockResolvedValue(current)
      mockSettingsService.resetSettings.mockResolvedValue(makeSettings())
      mockSettingsService.saveSettings.mockResolvedValue(makeSettings())
      mockWallpaperService.reapplyActiveWallpapers.mockResolvedValue(undefined)

      await caller.reset()

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith({
        onboardingComplete: true,
        dismissedScanReminder: false,
      })
    })

    it('should preserve dismissedScanReminder after reset', async () => {
      const current = makeSettings({ onboardingComplete: false, dismissedScanReminder: true })
      mockSettingsService.loadSettings.mockResolvedValue(current)
      mockSettingsService.resetSettings.mockResolvedValue(makeSettings())
      mockSettingsService.saveSettings.mockResolvedValue(makeSettings())
      mockWallpaperService.reapplyActiveWallpapers.mockResolvedValue(undefined)

      await caller.reset()

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith({
        onboardingComplete: false,
        dismissedScanReminder: true,
      })
    })
  })

  describe('defaults', () => {
    it('should return default settings', async () => {
      mockSettingsService.getDefaultSettings.mockReturnValue({ ...DEFAULT_SETTINGS })

      const result = await caller.defaults()
      expect(result).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('isFlatpak', () => {
    it('should return true when running in flatpak', async () => {
      mockIsFlatpak.mockReturnValue(true)
      const result = await caller.isFlatpak()
      expect(result).toEqual({ isFlatpak: true })
    })

    it('should return false when not in flatpak', async () => {
      mockIsFlatpak.mockReturnValue(false)
      const result = await caller.isFlatpak()
      expect(result).toEqual({ isFlatpak: false })
    })
  })
})
