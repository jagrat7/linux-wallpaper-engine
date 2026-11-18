import { describe, expect, it } from 'vite-plus/test'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { buildApplyOptions, pickRandomWallpaper } from './wallpaper.utils'
import { backendArgPattern, escapeRegExp } from '../../utils/host'

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

  it('only picks from the unused pool', () => {
    const activeIds = new Set(['/wp/a', '/wp/b'])
    for (let i = 0; i < 50; i++) {
      expect(pickRandomWallpaper(WALLPAPERS, activeIds).path).toBe('/wp/c')
    }
  })

  it('falls back to the full list when everything is active', () => {
    const activeIds = new Set(WALLPAPERS.map((w) => w.path))
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
    const options = buildApplyOptions(
      {
        ...DEFAULT_SETTINGS,
        windowMode: true,
        windowGeometry: '800x600',
      },
      { backgroundId: '/wp/a' },
    )

    expect(options.windowed).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('falls back to the emit-flag window mode when geometry is missing', () => {
    const options = buildApplyOptions(
      {
        ...DEFAULT_SETTINGS,
        windowMode: true,
        windowGeometry: null,
      },
      { backgroundId: '/wp/a' },
    )

    expect(options.windowed).toBe('emit-flag')
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so interpolated values match literally', () => {
    expect(escapeRegExp('/wp/a.b(c)[d]')).toBe('/wp/a\\.b\\(c\\)\\[d\\]')
  })
})

describe('backendArgPattern', () => {
  it('does not let a shorter screen name match a prefixed one', () => {
    const pattern = new RegExp(backendArgPattern('--screen-root', 'DP-1'))
    expect(pattern.test('linux-wallpaperengine --screen-root DP-1 --bg /wp')).toBe(true)
    expect(pattern.test('linux-wallpaperengine --screen-root DP-10 --bg /wp')).toBe(false)
  })

  it('matches the value as a full argument, not a prefix', () => {
    const pattern = new RegExp(backendArgPattern('--playlist', 'Mix'))
    expect(pattern.test('linux-wallpaperengine --playlist Mix --fps 60')).toBe(true)
    expect(pattern.test('linux-wallpaperengine --playlist Mixer --fps 60')).toBe(false)
  })
})
