import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Playlist } from '../../../shared/constants/playlist'

const { mockPlaylistService, mockSettingsService, mockHost } = vi.hoisted(() => ({
  mockPlaylistService: {
    getPlaylist: vi.fn(),
    stampLastApplied: vi.fn(),
    resolveWallpaperEngineAssetsDir: vi.fn(),
  },
  mockSettingsService: {
    loadSettings: vi.fn(),
    settingsToArgs: vi.fn(),
    getSetting: vi.fn(),
  },
  mockHost: {
    hostCommandExists: vi.fn(),
  },
}))

vi.mock('../settings', () => ({ settingsService: mockSettingsService }))
vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  ...mockHost,
}))

import { startPlaylistProcess } from './playlist-runner'

const playlist: Playlist = {
  name: 'Random Mix',
  items: ['/wallpapers/first'],
  settings: {
    delay: 1,
    timeunit: 'minutes',
    mode: 'timer',
    order: 'random',
    updateonpause: false,
    videosequence: false,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlaylistService.getPlaylist.mockResolvedValue(playlist)
  mockSettingsService.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
  mockSettingsService.settingsToArgs.mockReturnValue([])
  mockSettingsService.getSetting.mockReturnValue(false)
  mockPlaylistService.resolveWallpaperEngineAssetsDir.mockResolvedValue('/assets')
  mockHost.hostCommandExists.mockResolvedValue(true)
})

describe('startPlaylistProcess', () => {
  it('launches the backend for its screens', async () => {
    const launch = vi.fn().mockResolvedValue(undefined)

    const result = await startPlaylistProcess(
      mockPlaylistService,
      'Random Mix',
      ['HDMI-1'],
      true,
      launch,
    )

    expect(result).toEqual({ success: true })
    expect(mockPlaylistService.stampLastApplied).toHaveBeenCalledWith('Random Mix')
    expect(launch).toHaveBeenCalledWith(
      ['HDMI-1'],
      ['--screen-root', 'HDMI-1', '--playlist', 'Random Mix', '--assets-dir', '/assets'],
      expect.objectContaining({ backgroundId: '/wallpapers/first', screen: 'HDMI-1' }),
    )
  })

  it('does not launch when the backend is missing', async () => {
    mockHost.hostCommandExists.mockResolvedValue(false)
    const launch = vi.fn()

    const result = await startPlaylistProcess(
      mockPlaylistService,
      'Random Mix',
      ['HDMI-1'],
      true,
      launch,
    )

    expect(result.success).toBe(false)
    expect(mockPlaylistService.stampLastApplied).not.toHaveBeenCalled()
    expect(launch).not.toHaveBeenCalled()
  })
})
