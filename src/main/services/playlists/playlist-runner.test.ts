import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Playlist } from '../../../shared/constants/playlist'

const { mockPlaylistService, mockSettingsService, mockHost } = vi.hoisted(() => ({
  mockPlaylistService: {
    getPlaylist: vi.fn(),
    stampLastApplied: vi.fn(),
    setActivePlaylist: vi.fn(),
    resolveWallpaperEngineAssetsDir: vi.fn(),
  },
  mockSettingsService: {
    loadSettings: vi.fn(),
    settingsToArgs: vi.fn(),
    getSetting: vi.fn(),
  },
  mockHost: {
    hostCommandExists: vi.fn(),
    hostSpawn: vi.fn(),
    hostExecFileAsync: vi.fn(),
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
  mockHost.hostSpawn.mockReturnValue(new EventEmitter())
  mockHost.hostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
})

describe('startPlaylistProcess', () => {
  it('starts the backend, registers its process, and records the active playlist', async () => {
    const register = vi.fn()

    const result = await startPlaylistProcess(
      mockPlaylistService,
      'Random Mix',
      ['HDMI-1'],
      true,
      register,
    )

    expect(result).toEqual({ success: true })
    expect(mockPlaylistService.stampLastApplied).toHaveBeenCalledWith('Random Mix')
    expect(mockHost.hostSpawn).toHaveBeenCalledWith(
      'linux-wallpaperengine',
      ['--screen-root', 'HDMI-1', '--playlist', 'Random Mix', '--assets-dir', '/assets'],
      expect.any(Object),
    )
    expect(register).toHaveBeenCalledWith(
      ['HDMI-1'],
      expect.any(EventEmitter),
      expect.any(Array),
      expect.objectContaining({ backgroundId: '/wallpapers/first', screen: 'HDMI-1' }),
    )
    expect(mockPlaylistService.setActivePlaylist).toHaveBeenCalledWith('Random Mix', ['HDMI-1'])
  })

  it('does not spawn when the backend is missing', async () => {
    mockHost.hostCommandExists.mockResolvedValue(false)

    const result = await startPlaylistProcess(
      mockPlaylistService,
      'Random Mix',
      ['HDMI-1'],
      true,
      vi.fn(),
    )

    expect(result.success).toBe(false)
    expect(mockPlaylistService.stampLastApplied).not.toHaveBeenCalled()
    expect(mockHost.hostSpawn).not.toHaveBeenCalled()
  })
})
