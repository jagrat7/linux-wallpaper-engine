import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { mockHost } = vi.hoisted(() => ({
  mockHost: {
    hostSpawn: vi.fn(),
    hostExecFileAsync: vi.fn(),
    hostExecFileSync: vi.fn(),
    shouldUseFlatpakSpawn: vi.fn(),
  },
}))

vi.mock('./host', () => mockHost)

type FakeProc = EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }

// Every fake backend spawned in a test, in spawn order
let spawned: FakeProc[] = []

// Each test gets a fresh supervisor, since shutdown is one-way
const loadSupervisor = async () => {
  vi.resetModules()
  return (await import('./backend-supervisor')).backendSupervisor
}

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
    expect(onExit).toHaveBeenCalledOnce()
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
