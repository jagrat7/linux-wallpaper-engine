import { ChildProcess } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { backendArgPattern } from '../../utils/host'
import type { ScreenRecords } from './supervisor.types'
import {
  BACKEND_PROCESS_PATTERN,
  killSignal,
  leaveGroup,
  listBackendProcesses,
  processesOf,
  recordsFromSaved,
  screenPattern,
  screensDrivenBy,
  signalBackend,
  toSavedScreens,
} from './supervisor.utils'

const { mockHostExecFileAsync, mockShouldUseFlatpakSpawn } = vi.hoisted(() => ({
  mockHostExecFileAsync: vi.fn(),
  mockShouldUseFlatpakSpawn: vi.fn(),
}))

vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  hostExecFileAsync: mockHostExecFileAsync,
  shouldUseFlatpakSpawn: mockShouldUseFlatpakSpawn,
}))

// An unspawned handle: only its identity matters here
const makeProc = () => new ChildProcess()

const sharedRecords = (proc: ChildProcess): ScreenRecords => {
  const group = ['eDP-1', 'HDMI-1']
  return new Map([
    ['eDP-1', { options: { backgroundId: '/wp/1' }, group, paused: false, proc }],
    ['HDMI-1', { options: { backgroundId: '/wp/1' }, group, paused: true, proc }],
    ['DP-2', { options: { backgroundId: '/wp/2' }, group: ['DP-2'], paused: false }],
  ])
}

describe('killSignal', () => {
  it('sends SIGTERM under Flatpak for flatpak-spawn to forward, SIGKILL otherwise', () => {
    expect(killSignal(true)).toBe('SIGTERM')
    expect(killSignal(false)).toBe('SIGKILL')
  })
})

describe('screensDrivenBy and processesOf', () => {
  it('maps between a backend and the screens it draws on', () => {
    const proc = makeProc()
    const records = sharedRecords(proc)

    expect(screensDrivenBy(records, proc)).toEqual(['eDP-1', 'HDMI-1'])
    expect([...processesOf(records, ['eDP-1', 'HDMI-1', 'DP-2', 'missing'])]).toEqual([proc])
  })
})

describe('leaveGroup', () => {
  it('removes a moving screen from its former siblings only', () => {
    const records = sharedRecords(makeProc())

    leaveGroup(records, 'HDMI-1')

    expect(records.get('eDP-1')?.group).toEqual(['eDP-1'])
    expect(records.get('HDMI-1')?.group).toEqual(['eDP-1', 'HDMI-1'])
  })
})

describe('saved screens', () => {
  it('round-trips records through the store shape, without processes', () => {
    const records = sharedRecords(makeProc())

    const saved = toSavedScreens(records)
    const restored = recordsFromSaved(saved)

    expect(saved).toEqual({
      activeWallpapers: {
        'eDP-1': { backgroundId: '/wp/1' },
        'HDMI-1': { backgroundId: '/wp/1' },
        'DP-2': { backgroundId: '/wp/2' },
      },
      pausedScreens: ['HDMI-1'],
      screenGroups: {
        'eDP-1': ['eDP-1', 'HDMI-1'],
        'HDMI-1': ['eDP-1', 'HDMI-1'],
        'DP-2': ['DP-2'],
      },
    })
    expect(restored.get('HDMI-1')).toEqual({
      options: { backgroundId: '/wp/1' },
      group: ['eDP-1', 'HDMI-1'],
      paused: true,
    })
  })

  it('treats a screen saved without a group or pause mark as running alone', () => {
    const restored = recordsFromSaved({ activeWallpapers: { 'eDP-1': { backgroundId: '/wp/1' } } })

    expect(restored.get('eDP-1')).toEqual({
      options: { backgroundId: '/wp/1' },
      group: ['eDP-1'],
      paused: false,
    })
  })
})

describe('screenPattern', () => {
  it('finds a real screen by its --screen-root', () => {
    expect(screenPattern('DP-1', { backgroundId: '/wp/a' })).toBe(
      backendArgPattern('--screen-root', 'DP-1'),
    )
  })

  it('finds the window-mode screen by its playlist, then by its wallpaper', () => {
    expect(screenPattern('default', { playlist: 'Mix', backgroundId: '/wp/a' })).toBe(
      backendArgPattern('--playlist', 'Mix'),
    )
    expect(screenPattern('default', { backgroundId: '/wp/a' })).toBe(
      backendArgPattern('--bg', '/wp/a'),
    )
    expect(screenPattern('default', {})).toBeNull()
  })
})

describe('signalBackend', () => {
  const withKill = (kill: ReturnType<typeof vi.fn>) => Object.assign(new ChildProcess(), { kill })

  beforeEach(() => {
    mockHostExecFileAsync.mockReset()
    mockShouldUseFlatpakSpawn.mockReset()
    mockShouldUseFlatpakSpawn.mockReturnValue(false)
  })

  it('signals the tracked process handle and skips the host fallback', async () => {
    const kill = vi.fn().mockReturnValue(true)

    const delivered = await signalBackend(
      'SIGSTOP',
      withKill(kill),
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

    const delivered = await signalBackend(
      'SIGSTOP',
      withKill(kill),
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

    const delivered = await signalBackend(
      'SIGCONT',
      withKill(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(false)
    expect(mockHostExecFileAsync).not.toHaveBeenCalled()
  })

  it('reports failure when kill throws', async () => {
    const kill = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH')
    })

    const delivered = await signalBackend(
      'SIGSTOP',
      withKill(kill),
      'linux-wallpaperengine.*--screen-root.*eDP-1',
    )

    expect(delivered).toBe(false)
  })

  it('refuses to signal by bare executable name when no scoped pattern exists', async () => {
    const delivered = await signalBackend('SIGSTOP', undefined, null)

    expect(delivered).toBe(false)
    expect(mockHostExecFileAsync).not.toHaveBeenCalled()
  })

  it('sends SIGCONT via pkill when resuming without a handle', async () => {
    mockHostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })

    const delivered = await signalBackend(
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

    const delivered = await signalBackend(
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
