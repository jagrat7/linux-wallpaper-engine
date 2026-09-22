import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Playlist } from '../../../shared/constants/playlist'

const { mockPlaylistService, mockWallpaperService, mockSettingsService, mockDisplayService } =
  vi.hoisted(() => ({
    mockPlaylistService: {
      getPlaylists: vi.fn(),
      getPlaylist: vi.fn(),
      createPlaylist: vi.fn(),
      updatePlaylist: vi.fn(),
      deletePlaylist: vi.fn(),
      stampLastApplied: vi.fn(),
      getActivePlaylists: vi.fn(),
      setActivePlaylist: vi.fn(),
      clearActivePlaylist: vi.fn(),
      startProcess: vi.fn(),
    },
    mockWallpaperService: {
      stop: vi.fn(),
      apply: vi.fn(),
    },
    mockSettingsService: {
      loadSettings: vi.fn(),
      settingsToArgs: vi.fn(),
      getSetting: vi.fn(),
    },
    mockDisplayService: {
      detectDisplays: vi.fn(),
    },
  }))

vi.mock('../../services/playlists/playlist', () => ({
  playlistService: mockPlaylistService,
}))

vi.mock('../../services/wallpaper/wallpaper', () => ({
  wallpaperService: mockWallpaperService,
}))

vi.mock('../../services/settings', () => ({
  settingsService: mockSettingsService,
}))

vi.mock('../../services/display', () => ({
  displayService: mockDisplayService,
}))

import { trpc } from '../trpc'
import { playlistRouter } from './playlist'

const caller = trpc.createCallerFactory(playlistRouter)({ senderId: undefined })

const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  name: 'Random Mix',
  items: ['/wallpapers/first', '/wallpapers/second', '/wallpapers/third'],
  settings: {
    delay: 1,
    timeunit: 'minutes',
    mode: 'timer',
    order: 'random',
    updateonpause: false,
    videosequence: false,
  },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockPlaylistService.getPlaylist.mockResolvedValue(makePlaylist())
  mockPlaylistService.stampLastApplied.mockResolvedValue(undefined)
  mockWallpaperService.stop.mockResolvedValue({ success: true })
  mockWallpaperService.apply.mockResolvedValue({ success: true })
  mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
  mockSettingsService.settingsToArgs.mockReturnValue([])
  mockSettingsService.getSetting.mockReturnValue(false)
  mockDisplayService.detectDisplays.mockResolvedValue([
    { name: 'HDMI-1', primary: true },
    { name: 'DP-1', primary: false },
  ])
  mockPlaylistService.startProcess.mockResolvedValue({ success: true })
})

describe('playlistRouter', () => {
  describe('start', () => {
    it('starts the playlist on the selected screen', async () => {
      await caller.start({ playlistName: 'Random Mix', screen: 'HDMI-1' })

      expect(mockPlaylistService.startProcess).toHaveBeenCalledWith(
        'Random Mix',
        ['HDMI-1'],
        true,
        expect.any(Function),
      )
    })

    it('starts a playlist on all detected screens when no screen is selected', async () => {
      await caller.start({ playlistName: 'Random Mix' })

      expect(mockPlaylistService.startProcess).toHaveBeenCalledWith(
        'Random Mix',
        ['HDMI-1', 'DP-1'],
        true,
        expect.any(Function),
      )
      expect(mockWallpaperService.stop).toHaveBeenCalledWith(['HDMI-1', 'DP-1'])
      expect(mockPlaylistService.clearActivePlaylist).toHaveBeenCalledWith(['HDMI-1', 'DP-1'])
    })

    it('returns the process start error', async () => {
      mockPlaylistService.startProcess.mockResolvedValue({
        success: false,
        error: 'Backend missing',
      })

      const result = await caller.start({ playlistName: 'Random Mix', screen: 'HDMI-1' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Backend missing')
    })
  })

  describe('stop', () => {
    it('stops only matching playlist screens', async () => {
      mockPlaylistService.getActivePlaylists.mockReturnValue([
        { name: 'Random Mix', screen: 'HDMI-1' },
        { name: 'Other Mix', screen: 'DP-1' },
      ])

      await caller.stop({ playlistName: 'Random Mix' })

      expect(mockWallpaperService.stop).toHaveBeenCalledWith(['HDMI-1'])
      expect(mockPlaylistService.clearActivePlaylist).toHaveBeenCalledWith(['HDMI-1'])
    })

    it('restarts remaining screens when stopping one screen', async () => {
      mockPlaylistService.getActivePlaylists.mockReturnValue([
        { name: 'Random Mix', screen: 'HDMI-1' },
        { name: 'Random Mix', screen: 'DP-1' },
      ])

      await caller.stop({ playlistName: 'Random Mix', screen: 'HDMI-1' })

      expect(mockWallpaperService.stop).toHaveBeenCalledWith(['HDMI-1', 'DP-1'])
      expect(mockPlaylistService.clearActivePlaylist).toHaveBeenCalledWith(['HDMI-1', 'DP-1'])
      expect(mockPlaylistService.startProcess).toHaveBeenCalledWith(
        'Random Mix',
        ['DP-1'],
        false,
        expect.any(Function),
      )
    })
  })
})
