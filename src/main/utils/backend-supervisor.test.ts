import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ApplyWallpaperOptions } from '../../shared/constants/wallpaper'

// Store contents the supervisor reads on construction: saved screens from the last run
type Saved = { activeWallpapers?: Record<string, ApplyWallpaperOptions> } & Record<string, unknown>

const { mockHost, mockStore, saved } = vi.hoisted(() => {
  const store: { value: Record<string, unknown> } = { value: {} }
  return {
    saved: store,
    mockHost: {
      hostSpawn: vi.fn(),
      hostExecFileAsync: vi.fn(),
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

vi.mock('./host', () => mockHost)
vi.mock('../services/store', () => ({ storeService: { activeWallpapers: mockStore } }))

type FakeProc = EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }

// Every fake backend spawned in a test, in spawn order
let spawned: FakeProc[] = []

// Each test gets a fresh supervisor, since shutdown is one-way
const loadSupervisor = async (store: Saved = {}) => {
  saved.value = store
  vi.resetModules()
  return (await import('./backend-supervisor')).backendSupervisor
}

const stdio = 'ignore' as const
const wallpaper = (backgroundId = '/wp/1'): ApplyWallpaperOptions => ({ backgroundId })

beforeEach(() => {
  vi.clearAllMocks()
  spawned = []
  mockHost.hostSpawn.mockImplementation(() => {
    const proc = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() })
    spawned.push(proc)
    return proc
  })
  mockHost.hostExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
  mockHost.shouldUseFlatpakSpawn.mockReturnValue(false)
})

describe('backendSupervisor.run', () => {
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
})

describe('backendSupervisor.isIdle', () => {
  it('is false while a task runs or waits, and true once all have settled', async () => {
    const supervisor = await loadSupervisor()
    const gate = Promise.withResolvers<void>()
    expect(supervisor.isIdle).toBe(true)

    const first = supervisor.run(() => gate.promise.then(() => Promise.reject(new Error('x'))))
    const second = supervisor.run(async () => undefined)
    expect(supervisor.isIdle).toBe(false)

    gate.resolve()
    await expect(first).rejects.toThrow('x')
    await second
    expect(supervisor.isIdle).toBe(true)
  })
})

describe('backendSupervisor.spawn', () => {
  it('spawns a detached backend and reports an unexpected exit', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()

    supervisor.spawn(['--bg', '/wp/1'], { stdio: 'ignore', onExit })
    spawned[0].emit('exit', 1, null)

    expect(mockHost.hostSpawn).toHaveBeenCalledWith('linux-wallpaperengine', ['--bg', '/wp/1'], {
      detached: true,
      stdio: 'ignore',
    })
    expect(spawned[0].unref).toHaveBeenCalled()
    expect(onExit).toHaveBeenCalledWith([])
  })
})

describe('backendSupervisor.killMatching', () => {
  it('pkills each pattern and treats no match as success', async () => {
    const supervisor = await loadSupervisor()
    mockHost.hostExecFileAsync.mockRejectedValueOnce(new Error('pkill exited with code 1'))

    await supervisor.killMatching(['--screen-root eDP-1', '--screen-root HDMI-A-1'])

    expect(mockHost.hostExecFileAsync).toHaveBeenCalledWith('pkill', [
      '-9',
      '-f',
      '--screen-root HDMI-A-1',
    ])
  })
})

describe('backendSupervisor.shutdown', () => {
  it('kills every live backend and refuses new ones', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawn([], { stdio: 'ignore' })
    supervisor.spawn([], { stdio: 'ignore' })
    const [running, exited] = spawned
    exited.emit('exit', 0, null)

    supervisor.shutdown()

    expect(running.kill).toHaveBeenCalledWith('SIGKILL')
    expect(exited.kill).not.toHaveBeenCalled()
    expect(supervisor.isShuttingDown).toBe(true)
    expect(() => supervisor.spawn([], { stdio: 'ignore' })).toThrow('The app is quitting')
  })

  it('does not report exits caused by quitting as crashes', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    supervisor.spawn([], { stdio: 'ignore', onExit })

    supervisor.shutdown()
    spawned[0].emit('exit', null, 'SIGKILL')

    expect(onExit).not.toHaveBeenCalled()
  })

  it('kills host patterns only under Flatpak', async () => {
    const supervisor = await loadSupervisor()

    supervisor.shutdown(['--screen-root eDP-1'])

    expect(mockHost.hostExecFileSync).not.toHaveBeenCalled()
  })

  it('under Flatpak, sends SIGTERM for flatpak-spawn to forward and kills host patterns', async () => {
    const supervisor = await loadSupervisor()
    mockHost.shouldUseFlatpakSpawn.mockReturnValue(true)
    supervisor.spawn([], { stdio: 'ignore' })

    supervisor.shutdown(['--screen-root eDP-1'])

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGTERM')
    expect(mockHost.hostExecFileSync).toHaveBeenCalledWith('pkill', [
      '-9',
      '-f',
      '--screen-root eDP-1',
    ])
  })
})

describe('backendSupervisor.kill', () => {
  it('sends SIGKILL, or SIGTERM under Flatpak for flatpak-spawn to forward', async () => {
    const supervisor = await loadSupervisor()
    const native = supervisor.spawn([], { stdio })
    const flatpak = supervisor.spawn([], { stdio })

    supervisor.kill(native)
    mockHost.shouldUseFlatpakSpawn.mockReturnValue(true)
    supervisor.kill(flatpak)

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(spawned[1].kill).toHaveBeenCalledWith('SIGTERM')
  })
})

describe('backendSupervisor screens', () => {
  it('records a spawned backend against its screens and saves them', async () => {
    const supervisor = await loadSupervisor()

    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper(), ['--bg', '/wp/1'], { stdio })

    expect(supervisor.getProcess('eDP-1')).toBe(spawned[0])
    expect(supervisor.getActive().get('HDMI-1')).toEqual({
      backgroundId: '/wp/1',
      screen: 'HDMI-1',
    })
    expect(mockStore.set).toHaveBeenCalledWith('screenGroups', {
      'eDP-1': ['eDP-1', 'HDMI-1'],
      'HDMI-1': ['eDP-1', 'HDMI-1'],
    })
  })

  it('restores saved screens without a process until they are respawned', async () => {
    const supervisor = await loadSupervisor({
      activeWallpapers: { 'eDP-1': wallpaper() },
      pausedScreens: ['eDP-1'],
    })

    expect([...supervisor.getActive().keys()]).toEqual(['eDP-1'])
    expect(supervisor.getProcess('eDP-1')).toBeUndefined()
    expect(supervisor.isPaused('eDP-1')).toBe(true)

    supervisor.release(['eDP-1'])

    expect(supervisor.getActive().size).toBe(0)
    expect(supervisor.getPausedScreens()).toEqual([])
  })

  it('releases a shared backend and hands back the screens left without it', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper(), [], { stdio })
    supervisor.markPaused(['eDP-1'], true)

    const { remaining, released } = supervisor.release(['eDP-1'])

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(released).toEqual(['eDP-1'])
    expect(remaining).toEqual([{ screen: 'HDMI-1', options: expect.anything(), paused: true }])
    // HDMI-1 keeps its wallpaper but has no backend until the caller respawns it
    expect([...supervisor.getActive().keys()]).toEqual(['HDMI-1'])
    expect(supervisor.getProcess('HDMI-1')).toBeUndefined()
    expect(supervisor.getPausedScreens()).toEqual([])
  })

  it('detach kills a screen backend but keeps the screen saved for its respawn', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper(), [], { stdio, onExit })
    mockStore.set.mockClear()

    supervisor.detach(['eDP-1'])
    spawned[0].emit('exit', null, 'SIGKILL')

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(onExit).toHaveBeenCalledWith([])
    expect([...supervisor.getActive().keys()]).toEqual(['eDP-1', 'HDMI-1'])
    expect(supervisor.getProcess('HDMI-1')).toBeUndefined()
    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('reset kills every screen backend and saves an empty state', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1'], wallpaper(), [], { stdio })
    supervisor.markPaused(['eDP-1'], true)

    supervisor.reset()

    expect(spawned[0].kill).toHaveBeenCalledWith('SIGKILL')
    expect(supervisor.getActive().size).toBe(0)
    expect(mockStore.set).toHaveBeenCalledWith('pausedScreens', [])
    expect(mockStore.set).toHaveBeenLastCalledWith('screenGroups', {})
  })

  it('isActive needs a running backend, not only a saved screen', async () => {
    const supervisor = await loadSupervisor({ activeWallpapers: { 'eDP-1': wallpaper() } })
    expect(supervisor.isActive('/wp/1')).toBe(false)

    supervisor.spawnFor(['HDMI-1'], wallpaper('/wp/2'), [], { stdio })

    expect(supervisor.isActive('/wp/1')).toBe(true)
  })
})

describe('backendSupervisor pause marks', () => {
  it('expands pause and resume to the whole screen group, and saves them', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper(), [], { stdio })

    supervisor.markPaused(['eDP-1'], true)
    expect(supervisor.getPausedScreens()).toEqual(['eDP-1', 'HDMI-1'])
    expect(mockStore.set).toHaveBeenCalledWith('pausedScreens', ['eDP-1', 'HDMI-1'])

    supervisor.markPaused(['HDMI-1'], false)
    expect(supervisor.getPausedScreens()).toEqual([])
  })

  it('starts a respawned screen unpaused', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1'], wallpaper(), [], { stdio })
    supervisor.markPaused(['eDP-1'], true)

    supervisor.spawnFor(['eDP-1'], wallpaper(), [], { stdio })

    expect(supervisor.isPaused('eDP-1')).toBe(false)
  })

  it('stops pausing a screen with its old group once it moves to a new backend', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper(), [], { stdio })
    supervisor.spawnFor(['HDMI-1'], wallpaper('/wp/2'), [], { stdio })

    supervisor.markPaused(['eDP-1'], true)

    expect(supervisor.getPausedScreens()).toEqual(['eDP-1'])
  })
})

describe('backendSupervisor exits', () => {
  it('reports and forgets the screens an exiting backend still drove', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    supervisor.spawnFor(['eDP-1', 'HDMI-1'], wallpaper('/wp/old'), [], { stdio, onExit })
    supervisor.spawnFor(['HDMI-1'], wallpaper('/wp/new'), [], { stdio })

    spawned[0].emit('exit', 1, null)

    expect(onExit).toHaveBeenCalledWith(['eDP-1'])
    expect([...supervisor.getActive().keys()]).toEqual(['HDMI-1'])
  })

  it('reports nothing when a replaced backend exits late', async () => {
    const supervisor = await loadSupervisor()
    const onExit = vi.fn()
    supervisor.spawnFor(['eDP-1'], wallpaper('/wp/old'), [], { stdio, onExit })
    supervisor.release(['eDP-1'])
    supervisor.spawnFor(['eDP-1'], wallpaper('/wp/new'), [], { stdio })

    spawned[0].emit('exit', null, 'SIGKILL')

    expect(onExit).toHaveBeenCalledWith([])
    expect(supervisor.getActive().get('eDP-1')?.backgroundId).toBe('/wp/new')
  })

  it('keeps saved screens when backends exit because the app is quitting', async () => {
    const supervisor = await loadSupervisor()
    supervisor.spawnFor(['eDP-1'], wallpaper(), [], { stdio })
    mockStore.set.mockClear()

    supervisor.shutdown()
    spawned[0].emit('exit', null, 'SIGKILL')

    expect(mockStore.set).not.toHaveBeenCalled()
    expect([...supervisor.getActive().keys()]).toEqual(['eDP-1'])
  })
})
