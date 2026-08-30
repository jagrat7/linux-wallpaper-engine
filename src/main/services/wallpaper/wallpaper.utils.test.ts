import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { resolveSteamLibraryPaths, resolveWallpaperEngineAssetsDir, pickRandomWallpaper, buildApplyOptions } from './wallpaper.utils'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}))

const mockReadFile = vi.mocked(fs.readFile)
const mockAccess = vi.mocked(fs.access)

describe('resolveSteamLibraryPaths', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockAccess.mockReset()
  })

  it('includes Steam libraries from libraryfolders.vdf', async () => {
    mockReadFile.mockResolvedValueOnce(`
"libraryfolders"
{
  "0"
  {
    "path" "/home/user/.local/share/Steam"
  }
  "1"
  {
    "path" "/some/other/folder/Steam"
  }
}
`)

    const paths = await resolveSteamLibraryPaths(['~/.local/share/Steam'])

    expect(paths).toContain('/home/user/.local/share/Steam')
    expect(paths).toContain('/some/other/folder/Steam')
  })

  it('keeps default paths when libraryfolders.vdf is missing', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))

    await expect(resolveSteamLibraryPaths(['/steam'])).resolves.toEqual(['/steam'])
  })
})

describe('resolveWallpaperEngineAssetsDir', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockAccess.mockReset()
  })

  it('finds Wallpaper Engine assets in a Steam library', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))
    mockAccess.mockResolvedValueOnce(undefined)

    await expect(resolveWallpaperEngineAssetsDir(['/steam'])).resolves.toBe('/steam/steamapps/common/wallpaper_engine/assets')
  })

  it('returns null when no assets folder exists', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))
    mockAccess.mockRejectedValueOnce(new Error('missing'))

    await expect(resolveWallpaperEngineAssetsDir(['/steam'])).resolves.toBeNull()
  })
})

describe('pickRandomWallpaper', () => {
  const makeWallpaper = (path: string): Wallpaper => ({
    id: path,
    title: path,
    author: 'Author',
    type: 'scene',
    thumbnail: '',
    resolution: { width: 1920, height: 1080 },
    fileSize: 0,
    dateAdded: 0,
    tags: [],
    installed: true,
    path,
  })

  const WALLPAPERS = ['/wp/a', '/wp/b', '/wp/c'].map(makeWallpaper)

  it('never picks an actively applied wallpaper when alternatives exist', () => {
    const activeIds = new Set(['/wp/a'])
    for (let i = 0; i < 50; i++) {
      const pick = pickRandomWallpaper(WALLPAPERS, activeIds)
      expect(pick.path).not.toBe('/wp/a')
    }
  })

  it('only picks from the unused pool', () => {
    const activeIds = new Set(['/wp/a', '/wp/b'])
    for (let i = 0; i < 50; i++) {
      expect(pickRandomWallpaper(WALLPAPERS, activeIds).path).toBe('/wp/c')
    }
  })

  it('falls back to the full list when everything is active', () => {
    const activeIds = new Set(WALLPAPERS.map(w => w.path))
    const pick = pickRandomWallpaper(WALLPAPERS, activeIds)
    expect(WALLPAPERS).toContain(pick)
  })
})

describe('buildApplyOptions', () => {
  it('fills options from global settings', () => {
    const options = buildApplyOptions(DEFAULT_SETTINGS, { backgroundId: '/wp/a' })

    expect(options).toEqual({
      backgroundId: '/wp/a',
      screen: undefined,
      scaling: DEFAULT_SETTINGS.defaultScaling,
      fps: DEFAULT_SETTINGS.fps,
      volume: DEFAULT_SETTINGS.volume,
      silent: DEFAULT_SETTINGS.silent,
      noAutomute: DEFAULT_SETTINGS.noAutomute,
      noAudioProcessing: !DEFAULT_SETTINGS.audioProcessing,
      disableMouse: DEFAULT_SETTINGS.disableMouse,
      disableParallax: DEFAULT_SETTINGS.disableParallax,
      disableParticles: DEFAULT_SETTINGS.disableParticles,
      noFullscreenPause: !DEFAULT_SETTINGS.pauseOnFullscreen,
      windowed: undefined,
    })
  })

  it('lets input values override global settings', () => {
    const options = buildApplyOptions(DEFAULT_SETTINGS, {
      backgroundId: '/wp/a',
      screen: 'HDMI-1',
      fps: 144,
      volume: 30,
      silent: true,
      scaling: 'stretch',
    })

    expect(options.fps).toBe(144)
    expect(options.volume).toBe(30)
    expect(options.silent).toBe(true)
    expect(options.scaling).toBe('stretch')
    expect(options.screen).toBe('HDMI-1')
  })

  it('uses parsed window geometry in window mode', () => {
    const options = buildApplyOptions({
      ...DEFAULT_SETTINGS,
      windowMode: true,
      windowGeometry: '800x600',
    }, { backgroundId: '/wp/a' })

    expect(options.windowed).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('falls back to the emit-flag window mode when geometry is missing', () => {
    const options = buildApplyOptions({
      ...DEFAULT_SETTINGS,
      windowMode: true,
      windowGeometry: null,
    }, { backgroundId: '/wp/a' })

    expect(options.windowed).toBe('emit-flag')
  })
})
