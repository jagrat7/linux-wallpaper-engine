import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import { backendArgPattern } from '../../utils/host'
import { BACKEND_PROCESS_PATTERN } from './supervisor.utils'

// Store contents the supervisor reads on construction: saved screens from the last run
type Saved = { activeWallpapers?: Record<string, ApplyWallpaperOptions> } & Record<string, unknown>

const { mockHost, mockStore, saved } = vi.hoisted(() => {
  const store: { value: Record<string, unknown> } = { value: {} }
  return {
    saved: store,
    mockHost: {
      hostSpawn: vi.fn(),
      hostExecFileAsync:
        vi.fn<(file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>>(),
      hostExecFileSync: vi.fn(),
      shouldUseFlatpakSpawn: vi.fn(),
    },
    mockStore: {
      get: vi.fn(
        (key: string) => store.value[key] ?? (key === 'activeWallpapers' ? {} : undefined),
      ),
      set: vi.fn(),
    },
  }
})

vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  ...mockHost,
}))
vi.mock('../store', () => ({ storeService: { activeWallpapers: mockStore } }))

type FakeProc = EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }

// Every fake backend spawned in a test, in spawn order
let spawned: FakeProc[] = []

// Each test gets a fresh supervisor, since shutdown is one-way
const loadSupervisor = async (store: Saved = {}) => {
  saved.value = store
  vi.resetModules()
  return (await import('./supervisor')).supervisorService
}

const stdio = 'ignore' as const
const wallpaper = (backgroundId = '/wp/1'): ApplyWallpaperOptions => ({ backgroundId })
const pkilled = () =>
  mockHost.hostExecFileAsync.mock.calls
    .filter(([command]) => command === 'pkill')
    .map(([, args]) => args.join(' '))

beforeEach(() => {
  vi.clearAllMocks()
  spawned = []
  mockHost.hostSpawn.mockImplementation(() => {
    const proc = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn(() => true) })
    spawned.push(proc)
    return proc
  })
  mockHost.hostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
  mockHost.shouldUseFlatpakSpawn.mockReturnValue(false)
})

describe('supervisorService.run', () => {
  it('starts a task only after the previous one settles, even when it fails', async () => {
    const supervisor = await loadSupervisor()
    const order: string[] = []
    const gate = Promise.withResolvers<void>()

    const first = supervisor.run(async () => {
      order.push('first:start')
      await gate.promise
      order.push('first:end')
      throw new Error('spawn failed')
    })
    const second = supervisor.run(async () => {
      order.push('second')
      return 'done'
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    gate.resolve()

    await expect(first).rejects.toThrow('spawn failed')
    await expect(second).resolves.toBe('done')
    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })

  it('is idle only once every task has settled', async () => {
    const supervisor = await loadSupervisor()
    const gate = Promise.withResolvers<void>()
    expect(supervisor.idle).toBe(true)

    const first = supervisor.run(() => gate.promise.then(() => Promise.reject(new Error('x'))))
    const second = supervisor.run(async () => undefined)
    expect(supervisor.idle).toBe(false)

    gate.resolve()
    await expect(first).rejects.toThrow('x')
    await second
    expect(supervisor.idle).toBe(true)
  })
})

describe('supervisorService.start', () => {
  it('starts a one-off backend detached and reports its exit with no screens', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()

    await supervisor.start(['--bg', '/wp/1'], { stdio, onExit })
    spawned[0].emit('exit', 1, null)

    expect(mockHost.hostSpawn).toHaveBeenCalledWith('linux-wallpaperengine', ['--bg', '/wp/1'], {
      detached: true,
      stdio,
    })
    expect(spawned[0].unref).toHaveBeenCalled()
    expect(onExit).toHaveBeenCalledWith([])
    expect(pkilled()).toEqual([])
  })

  it('replaces whatever drew on the screens, then records and saves the new backend', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1', 'HDMI-1'], wallpaper: wallpaper() })

    await supervisor.start([], {
      stdio,
      screens: ['eDP-1', 'HDMI-1'],
      wallpaper: wallpaper('/wp/2'),
    })

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(pkilled()).toContain(`-9 -f ${backendArgPattern('--screen-root', 'eDP-1')}`)
    expect(supervisor.screens().get('HDMI-1')).toMatchObject({
      options: { backgroundId: '/wp/2', screen: 'HDMI-1' },
      proc: spawned[1],
    })
    expect(mockStore.set).toHaveBeenCalledWith('screenGroups', {
      'eDP-1': ['eDP-1', 'HDMI-1'],
      'HDMI-1': ['eDP-1', 'HDMI-1'],
    })
  })

  it('keeps a paused screen marked paused across the respawn', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { 'eDP-1': wallpaper() },
      pausedScreens: ['eDP-1'],
    })
    mockStore.set.mockClear()

    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })

    expect(supervisor.screens().get('eDP-1')?.paused).toBe(true)
    expect(mockStore.set).not.toHaveBeenCalledWith('pausedScreens', [])
  })
})

describe('supervisorService playlists', () => {
  it('records the playlist a backend runs, until a wallpaper replaces it', async () => {
    const supervisor = await loadSupervisor()

    await supervisor.start([], {
      stdio,
      screens: ['eDP-1'],
      wallpaper: wallpaper(),
      playlist: 'Mix',
    })
    expect(supervisor.screens().get('eDP-1')?.playlist).toBe('Mix')
    expect(mockStore.set).toHaveBeenCalledWith('activePlaylists', {
      'eDP-1': { name: 'Mix', screen: 'eDP-1' },
    })

    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper('/wp/2') })
    expect(supervisor.screens().get('eDP-1')?.playlist).toBeUndefined()
    expect(mockStore.set).toHaveBeenLastCalledWith('screenGroups', { 'eDP-1': ['eDP-1'] })
    expect(mockStore.set).toHaveBeenCalledWith('activePlaylists', {})
  })

  it('forgets the playlist when its backend exits', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], {
      stdio,
      screens: ['eDP-1'],
      wallpaper: wallpaper(),
      playlist: 'Mix',
    })

    spawned[0].emit('exit', 1, null)

    expect(supervisor.screens().size).toBe(0)
    expect(mockStore.set).toHaveBeenLastCalledWith('screenGroups', {})
    expect(mockStore.set).toHaveBeenCalledWith('activePlaylists', {})
  })

  it('reads a playlist saved by an older version under activePlaylist', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { 'eDP-1': wallpaper() },
      activePlaylist: { name: 'Mix', screen: 'eDP-1' },
    })

    expect(supervisor.screens().get('eDP-1')?.playlist).toBe('Mix')
  })

  it('hands back the playlist of a screen left without its shared backend', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], {
      stdio,
      screens: ['eDP-1', 'HDMI-1'],
      wallpaper: wallpaper(),
      playlist: 'Mix',
    })

    const { remaining } = await supervisor.stop({ screens: ['eDP-1'] })

    expect(remaining).toEqual([expect.objectContaining({ screen: 'HDMI-1', playlist: 'Mix' })])
  })
})

describe('supervisorService.stop', () => {
  it('stops a shared backend and hands back the screens left without it', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1', 'HDMI-1'], wallpaper: wallpaper() })
    await supervisor.setPaused(['eDP-1'], true)

    const { stopped, remaining } = await supervisor.stop({ screens: ['eDP-1'] })

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(stopped).toEqual(['eDP-1'])
    expect(remaining).toEqual([{ screen: 'HDMI-1', options: expect.anything(), paused: true }])
    // HDMI-1 keeps its wallpaper and paused mark but has no backend until respawned
    expect([...supervisor.screens().keys()]).toEqual(['HDMI-1'])
    expect(supervisor.screens().get('HDMI-1')?.paused).toBe(true)
    expect(supervisor.screens().get('HDMI-1')?.proc).toBeUndefined()
  })

  it('stops every screen by its own pattern, never every backend on the machine', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })
    mockHost.hostExecFileAsync.mockClear()

    const { stopped } = await supervisor.stop()

    expect(stopped).toEqual(['eDP-1'])
    expect(supervisor.screens().size).toBe(0)
    expect(pkilled()).toEqual([`-9 -f ${backendArgPattern('--screen-root', 'eDP-1')}`])
    expect(pkilled().join()).not.toContain(BACKEND_PROCESS_PATTERN)
    expect(mockStore.set).toHaveBeenLastCalledWith('screenGroups', {})
  })

  it('finds the window-mode backend by the playlist it runs', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { default: wallpaper() },
      activePlaylists: { default: { name: 'Mix', screen: 'default' } },
    })

    await supervisor.stop()

    expect(pkilled()).toEqual([`-9 -f ${backendArgPattern('--playlist', 'Mix')}`])
  })

  it('with keep, kills the backend but keeps the screens saved', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper(), onExit })
    mockStore.set.mockClear()

    await supervisor.stop({ keep: true })
    spawned[0].emit('exit', null, 'SIGKILL')

    expect(onExit).toHaveBeenCalledWith([])
    expect([...supervisor.screens().keys()]).toEqual(['eDP-1'])
    expect(mockStore.set).not.toHaveBeenCalledWith('activeWallpapers', {})
  })

  it('drops a restored screen that never had a backend without killing anything tracked', async () => {
    const supervisor = await loadSupervisor({ activeWallpapers: { 'eDP-1': wallpaper() } })

    const { stopped } = await supervisor.stop({ screens: ['eDP-1'] })

    expect(stopped).toEqual(['eDP-1'])
    expect(supervisor.screens().size).toBe(0)
    expect(mockHost.hostSpawn).not.toHaveBeenCalled()
  })
})

describe('supervisorService.setPaused', () => {
  it('signals a shared backend once and marks its whole group', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1', 'HDMI-1'], wallpaper: wallpaper() })

    const paused = await supervisor.setPaused(['eDP-1', 'HDMI-1'], true)

    expect(spawned[0].kill).toHaveBeenCalledTimes(1)
    expect(spawned[0].kill).toHaveBeenCalledWith('SIGSTOP')
    expect(paused).toEqual({ changed: ['eDP-1', 'HDMI-1'], failed: [] })
    expect(mockStore.set).toHaveBeenCalledWith('pausedScreens', ['eDP-1', 'HDMI-1'])

    const resumed = await supervisor.setPaused(['HDMI-1'], false)
    expect(spawned[0].kill).toHaveBeenLastCalledWith('SIGCONT')
    expect(resumed.changed).toEqual(['eDP-1', 'HDMI-1'])
  })

  it('freezes a respawned backend whose screen is still marked paused', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { 'eDP-1': wallpaper() },
      pausedScreens: ['eDP-1'],
    })
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })

    const result = await supervisor.setPaused(['eDP-1'], true)

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGSTOP')
    // Already marked paused, so nothing flipped
    expect(result).toEqual({ changed: [], failed: [] })
  })

  it('reports a screen whose backend could not be signalled', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })
    spawned[0].kill.mockReturnValue(false)

    expect(await supervisor.setPaused(['eDP-1'], true)).toEqual({ changed: [], failed: ['eDP-1'] })
    expect(supervisor.screens().get('eDP-1')?.paused).toBe(false)
  })

  it('stops pausing a screen with its old group once it moves to a new backend', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1', 'HDMI-1'], wallpaper: wallpaper() })
    await supervisor.start([], { stdio, screens: ['HDMI-1'], wallpaper: wallpaper('/wp/2') })

    await supervisor.setPaused(['eDP-1'], true)

    expect(supervisor.screens().get('HDMI-1')?.paused).toBe(false)
  })
})

describe('supervisorService.kill', () => {
  it('sends SIGKILL, or SIGTERM under Flatpak for flatpak-spawn to forward', async () => {
    const supervisor = await loadSupervisor()
    const native = await supervisor.start([], { stdio })
    const flatpak = await supervisor.start([], { stdio })

    supervisor.kill(native)
    mockHost.shouldUseFlatpakSpawn.mockReturnValue(true)
    supervisor.kill(flatpak)

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(spawned[1].kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('resumes a frozen backend first, since it would hold SIGTERM until then', async () => {
    const supervisor = await loadSupervisor()
    const proc = await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })
    await supervisor.setPaused(['eDP-1'], true)

    supervisor.kill(proc)

    expect(spawned[0].kill.mock.calls.map(([signal]) => signal)).toEqual([
      'SIGSTOP',
      'SIGCONT',
      'SIGKILL',
    ])
  })
})

describe('supervisorService.prune', () => {
  it('forgets restored screens whose backend is gone and keeps running ones', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { 'eDP-1': wallpaper(), 'HDMI-1': wallpaper() },
    })
    mockHost.hostExecFileAsync.mockImplementation(async (command: string) =>
      command === 'pgrep'
        ? { stdout: '101 linux-wallpaperengine --screen-root HDMI-1 --bg /wp/1\n', stderr: '' }
        : { stdout: '', stderr: '' },
    )

    expect(await supervisor.prune()).toEqual(['eDP-1'])
    expect([...supervisor.screens().keys()]).toEqual(['HDMI-1'])
  })
})

describe('supervisorService exits', () => {
  it('reports and forgets only the screens an exiting backend drove', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper(), onExit })
    await supervisor.start([], { stdio, screens: ['HDMI-1'], wallpaper: wallpaper('/wp/2') })

    spawned[0].emit('exit', 1, null)

    expect(onExit).toHaveBeenCalledWith(['eDP-1'])
    expect([...supervisor.screens().keys()]).toEqual(['HDMI-1'])
  })

  it('reports nothing when a backend it replaced exits late', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    await supervisor.start([], {
      stdio,
      screens: ['eDP-1', 'HDMI-1'],
      wallpaper: wallpaper(),
      onExit,
    })
    await supervisor.start([], { stdio, screens: ['HDMI-1'], wallpaper: wallpaper('/wp/2') })

    spawned[0].emit('exit', null, 'SIGKILL')

    expect(onExit).toHaveBeenCalledWith([])
    // eDP-1 shared the replaced backend: still recorded, waiting for a respawn
    expect(supervisor.screens().get('eDP-1')?.proc).toBeUndefined()
    expect(supervisor.screens().get('HDMI-1')?.proc).toBe(spawned[1])
  })

  it('keeps saved screens when backends exit because the app is quitting', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })
    mockStore.set.mockClear()

    supervisor.shutdown()
    spawned[0].emit('exit', null, 'SIGKILL')

    expect(mockStore.set).not.toHaveBeenCalled()
    expect([...supervisor.screens().keys()]).toEqual(['eDP-1'])
  })
})

describe('supervisorService.shutdown', () => {
  it('kills every live backend, including one-off ones, and refuses new ones', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio })
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })

    supervisor.shutdown()

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(spawned[1].kill).toHaveBeenCalledWith('SIGKILL')
    expect(mockHost.hostExecFileSync).not.toHaveBeenCalled()
    await expect(supervisor.start([], { stdio })).rejects.toThrow('The app is quitting')
  })

  it('under Flatpak, also kills each screen backend on the host by its pattern', async () => {
    const supervisor = await loadSupervisor()
    await supervisor.start([], { stdio, screens: ['eDP-1'], wallpaper: wallpaper() })
    mockHost.shouldUseFlatpakSpawn.mockReturnValue(true)

    supervisor.shutdown()

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGTERM')
    expect(mockHost.hostExecFileSync).toHaveBeenCalledWith('pkill', [
      '-9',
      '-f',
      backendArgPattern('--screen-root', 'eDP-1'),
    ])
  })
})
