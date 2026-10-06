import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ChildProcess } from 'node:child_process'
import { DEFAULT_SETTINGS } from '../../../shared/constants/app'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import {
  BACKEND_PROCESS_PATTERN,
  buildApplyOptions,
  isScreenBackendRunning,
  listBackendProcesses,
  pickRandomWallpaper,
  signalWallpaperProcess,
} from './wallpaper.utils'
import { backendArgPattern, escapeRegExp } from '../../utils/host'

const { mockHostExecFileAsync, mockShouldUseFlatpakSpawn } = vi.hoisted(() => ({
  mockHostExecFileAsync: vi.fn(),
  mockShouldUseFlatpakSpawn: vi.fn(),
}))

vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  hostExecFileAsync: mockHostExecFileAsync,
  shouldUseFlatpakSpawn: mockShouldUseFlatpakSpawn,
}))

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

describe('signalWallpaperProcess', () => {
  const makeProc = (kill: ReturnType<typeof vi.fn>): ChildProcess =>
    ({ kill }) as unknown as ChildProcess

  beforeEach(() => {
    mockHostExecFileAsync.mockReset()
    mockShouldUseFlatpakSpawn.mockReset()
    mockShouldUseFlatpakSpawn.mockReturnValue(false)
  })

  it('signals the tracked process handle and skips the host fallback', async () => {
    const kill = vi.fn().mockReturnValue(true)

    const delivered = await signalWallpaperProcess(
      'SIGSTOP',
      makeProc(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(true)
    expect(kill).toHaveBeenCalledWith('SIGSTOP')
    expect(mockHostExecFileAsync).not.toHaveBeenCalled()
  })

  it('falls back to a host-side pkill when the handle wraps flatpak-spawn', async () => {
    mockShouldUseFlatpakSpawn.mockReturnValue(true)
    mockHostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
    const kill = vi.fn().mockReturnValue(true)

    const delivered = await signalWallpaperProcess(
      'SIGSTOP',
      makeProc(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(true)
    expect(kill).not.toHaveBeenCalled()
    expect(mockHostExecFileAsync).toHaveBeenCalledWith('pkill', [
      '-STOP',
      '-f',
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    ])
  })

  it('reports failure when kill returns false without throwing', async () => {
    const kill = vi.fn().mockReturnValue(false)

    const delivered = await signalWallpaperProcess(
      'SIGCONT',
      makeProc(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(false)
    expect(mockHostExecFileAsync).not.toHaveBeenCalled()
  })

  it('reports failure when kill throws', async () => {
    const kill = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH')
    })

    const delivered = await signalWallpaperProcess(
      'SIGSTOP',
      makeProc(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(false)
  })

  it('refuses to signal by bare executable name when no scoped pattern exists', async () => {
    const delivered = await signalWallpaperProcess('SIGSTOP', undefined, null)

    expect(delivered).toBe(false)
    expect(mockHostExecFileAsync).not.toHaveBeenCalled()
  })

  it('falls back to pkill for screens without a tracked handle', async () => {
    mockHostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })

    const delivered = await signalWallpaperProcess(
      'SIGSTOP',
      undefined,
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(true)
    expect(mockHostExecFileAsync).toHaveBeenCalledWith('pkill', [
      '-STOP',
      '-f',
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    ])
  })

  it('sends SIGCONT via pkill when resuming without a handle', async () => {
    mockHostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })

    const delivered = await signalWallpaperProcess(
      'SIGCONT',
      undefined,
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(true)
    expect(mockHostExecFileAsync).toHaveBeenCalledWith('pkill', [
      '-CONT',
      '-f',
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    ])
  })

  it('reports failure when the host fallback rejects', async () => {
    mockHostExecFileAsync.mockRejectedValue(new Error('no process matched'))

    const delivered = await signalWallpaperProcess(
      'SIGSTOP',
      undefined,
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(false)
  })
})

describe('listBackendProcesses', () => {
  beforeEach(() => {
    mockHostExecFileAsync.mockReset()
  })

  it('matches full command lines, since the backend name exceeds the 15-char comm', async () => {
    mockHostExecFileAsync.mockResolvedValue({
      stdout: '101 linux-wallpaperengine --screen-root DP-1 --bg /wp/a\n',
      stderr: '',
    })

    await expect(listBackendProcesses()).resolves.toEqual([
      '101 linux-wallpaperengine --screen-root DP-1 --bg /wp/a',
    ])
    expect(mockHostExecFileAsync).toHaveBeenCalledWith('pgrep', ['-af', BACKEND_PROCESS_PATTERN])
  })

  it('returns no processes when pgrep finds no match', async () => {
    mockHostExecFileAsync.mockRejectedValue(new Error('exit code 1'))

    await expect(listBackendProcesses()).resolves.toEqual([])
  })
})

describe('BACKEND_PROCESS_PATTERN', () => {
  const pattern = new RegExp(BACKEND_PROCESS_PATTERN)

  it('matches plain, absolute, and Nix-wrapped executables', () => {
    expect(pattern.test('linux-wallpaperengine --bg /wp')).toBe(true)
    expect(pattern.test('/usr/bin/linux-wallpaperengine --bg /wp')).toBe(true)
    expect(pattern.test('/nix/store/x/bin/.linux-wallpaperengine-wrapped --bg /wp')).toBe(true)
  })

  it('ignores processes that only mention the backend in their arguments', () => {
    expect(pattern.test('flatpak-spawn --host linux-wallpaperengine --bg /wp')).toBe(false)
    expect(pattern.test('vim linux-wallpaperengine.log')).toBe(false)
  })
})

describe('isScreenBackendRunning', () => {
  const processes = [
    '101 linux-wallpaperengine --screen-root DP-1 --bg /wp/a',
    '102 linux-wallpaperengine --bg /wp/b',
  ]

  it('matches a screen by its exact --screen-root argument', () => {
    expect(isScreenBackendRunning('DP-1', processes)).toBe(true)
    expect(isScreenBackendRunning('DP-10', processes)).toBe(false)
  })

  it('finds the default process even when per-screen processes also run', () => {
    expect(isScreenBackendRunning('default', processes)).toBe(true)
    expect(isScreenBackendRunning('default', processes.slice(0, 1))).toBe(false)
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so interpolated values match literally', () => {
    expect(escapeRegExp('/wp/a.b(c)[d]')).toBe('/wp/a\\.b\\(c\\)\\[d\\]')
  })

  it('leaves plain screen names untouched', () => {
    expect(escapeRegExp('eDP-1')).toBe('eDP-1')
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
