import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Playlist } from '../../../shared/constants/playlist'

const { mockPlaylistService, mockWallpaperService, mockSettingsService, mockDisplayService, mockHost, mockWallpaperUtils } = vi.hoisted(() => ({
  mockPlaylistService: {
    getPlaylists: vi.fn(),
    getPlaylist: vi.fn(),
    createPlaylist: vi.fn(),
    updatePlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    stampLastApplied: vi.fn(),
    getActivePlaylist: vi.fn(),
    setActivePlaylist: vi.fn(),
    clearActivePlaylist: vi.fn(),
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
  mockHost: {
    hostCommandExists: vi.fn(),
    hostSpawn: vi.fn(),
  },
  mockWallpaperUtils: {
    resolveWallpaperEngineAssetsDir: vi.fn(),
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

vi.mock('../../utils/host', () => mockHost)

vi.mock('../../services/wallpaper/wallpaper.utils', () => mockWallpaperUtils)

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
  mockDisplayService.detectDisplays.mockResolvedValue([{ name: 'HDMI-1', primary: true }])
  mockHost.hostCommandExists.mockResolvedValue(true)
  mockHost.hostSpawn.mockReturnValue(new EventEmitter())
  mockWallpaperUtils.resolveWallpaperEngineAssetsDir.mockResolvedValue('/assets')
})

describe('playlistRouter', () => {
  describe('start', () => {
    it('stamps the playlist and spawns linux-wallpaperengine', async () => {
      await caller.start({ playlistName: 'Random Mix', screen: 'HDMI-1' })

      expect(mockPlaylistService.stampLastApplied).toHaveBeenCalledWith('Random Mix')
      expect(mockHost.hostSpawn).toHaveBeenCalledWith('linux-wallpaperengine', [
        '--screen-root',
        'HDMI-1',
        '--playlist',
        'Random Mix',
        '--assets-dir',
        '/assets',
      ], expect.any(Object))
    })

    it('does not stamp or spawn when the backend is missing', async () => {
      mockHost.hostCommandExists.mockResolvedValue(false)

      const result = await caller.start({ playlistName: 'Random Mix', screen: 'HDMI-1' })

      expect(result.success).toBe(false)
      expect(mockPlaylistService.stampLastApplied).not.toHaveBeenCalled()
      expect(mockHost.hostSpawn).not.toHaveBeenCalled()
    })
  })
})
