import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
import { ChildProcess } from 'node:child_process'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// --- Mocks ---------------------------------------------------------------

const { mockStore, mockPlaylistService } = vi.hoisted(() => ({
  // The state manager reads the store on import, so it starts with no wallpapers
  mockStore: {
    get: vi.fn((key: string) =>
      key === 'activeWallpapers' || key === 'overrides' ? {} : undefined,
    ),
    set: vi.fn(),
  },
  mockPlaylistService: {
    resolveSteamLibraryPaths: vi.fn(),
    resolveWallpaperEngineAssetsDir: vi.fn(),
    startProcess: vi.fn(),
  },
}))

vi.mock('../store', () => ({
  storeService: { activeWallpapers: mockStore, wallpaperOverrides: mockStore },
}))
vi.mock('../playlists/playlist', () => ({ playlistService: mockPlaylistService }))
vi.mock('../settings', () => ({
  settingsService: {
    loadSettings: vi.fn(async () => ({ windowMode: false, fps: 60, volume: 100 })),
    getSetting: vi.fn(),
  },
}))
vi.mock('../display', () => ({ displayService: { detectDisplays: vi.fn() } }))
vi.mock('../compatibility', () => ({ compatibilityService: { monitorProcess: vi.fn() } }))
vi.mock('../invalidation', () => ({ invalidationService: { emit: vi.fn() } }))
vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  // `du` for sizes, `file` for resolutions; empty output is fine for these tests
  hostExecFileAsync: vi.fn(async () => ({ stdout: '', stderr: '' })),
  hostCommandExists: vi.fn(async () => true),
  hostSpawn: vi.fn(() => Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() })),
}))

// --- Fixture: a Steam library with one installed wallpaper -----------------

const library = fs.mkdtempSync(path.join(os.tmpdir(), 'lwe-library-'))
const wallpaperPath = path.join(library, 'steamapps/workshop/content/431960/111')
fs.mkdirSync(wallpaperPath, { recursive: true })
fs.writeFileSync(
  path.join(wallpaperPath, 'project.json'),
  JSON.stringify({ title: 'Forest Stream', type: 'scene', preview: 'preview.jpg' }),
)

afterAll(() => fs.rmSync(library, { recursive: true, force: true }))

import { wallpaperService } from './wallpaper'
import { supervisorService } from '../supervisor/supervisor'
import { hostSpawn } from '../../utils/host'

beforeEach(async () => {
  vi.clearAllMocks()
  mockPlaylistService.resolveSteamLibraryPaths.mockResolvedValue([library])
  await supervisorService.stop()
  await wallpaperService.diagnose({ kind: 'invalidateCache' })
})

// --- Tests ---------------------------------------------------------------

describe('wallpaperService catalog', () => {
  it('shares one library scan between callers that arrive while it runs', async () => {
    const results = await Promise.all([
      wallpaperService.catalog(),
      wallpaperService.catalog(),
      wallpaperService.catalog(),
    ])

    expect(mockPlaylistService.resolveSteamLibraryPaths).toHaveBeenCalledOnce()
    expect(results[0].wallpapers.map((w) => w.title)).toEqual(['Forest Stream'])
    expect(results[2].wallpapers).toBe(results[0].wallpapers)
  })

  it('scans again after the cache is invalidated', async () => {
    await wallpaperService.catalog()
    await wallpaperService.diagnose({ kind: 'invalidateCache' })
    await wallpaperService.catalog()

    expect(mockPlaylistService.resolveSteamLibraryPaths).toHaveBeenCalledTimes(2)
  })
})

describe('wallpaperService.getActive', () => {
  it('returns active wallpapers from project.json without scanning the library', async () => {
    await supervisorService.start([], {
      stdio: 'ignore',
      screens: ['eDP-1'],
      wallpaper: { backgroundId: wallpaperPath },
    })

    const active = await wallpaperService.getActive()

    expect(mockPlaylistService.resolveSteamLibraryPaths).not.toHaveBeenCalled()
    expect(active).toEqual([
      expect.objectContaining({
        screen: 'eDP-1',
        title: 'Forest Stream',
        thumbnail: path.join(wallpaperPath, 'preview.jpg'),
        paused: false,
      }),
    ])
  })
})

// A screen saved by the last run, with no process handle yet
const loadWithRestoredScreen = async () => {
  mockStore.get.mockImplementation((key: string) => {
    if (key === 'activeWallpapers') return { 'eDP-1': { backgroundId: wallpaperPath } }
    return key === 'overrides' ? {} : undefined
  })
  vi.resetModules()
  const { wallpaperService: service } = await import('./wallpaper')
  const { supervisorService: supervisor } = await import('../supervisor/supervisor')
  return { service, supervisor }
}

describe('wallpaperService.getActive during restore', () => {
  afterAll(() => {
    mockStore.get.mockImplementation((key: string) =>
      key === 'activeWallpapers' || key === 'overrides' ? {} : undefined,
    )
  })

  it('keeps a restored screen while process work is running, then prunes it once idle', async () => {
    const { service, supervisor } = await loadWithRestoredScreen()
    const restore = Promise.withResolvers<void>()
    const restoring = supervisor.run(() => restore.promise)

    expect((await service.getActive()).map((entry) => entry.screen)).toEqual(['eDP-1'])

    restore.resolve()
    await restoring
    // pgrep (mocked) finds no backend for eDP-1, so the idle prune drops it
    expect(await service.getActive()).toEqual([])
  })
})

describe('wallpaperService.apply wallpaper', () => {
  it('brings back the previous wallpaper when the new one exits straight away', async () => {
    await supervisorService.start(['--bg', '/wp/1'], {
      screens: ['eDP-1'],
      wallpaper: { backgroundId: '/wp/1' },
      stdio: 'ignore',
    })
    // The next backend dies on start, like one the engine can't run
    let failed: ChildProcess | undefined
    vi.mocked(hostSpawn).mockImplementationOnce(() => {
      const proc = Object.assign(new ChildProcess(), { unref: vi.fn(), kill: vi.fn() })
      setTimeout(() => proc.emit('exit', 1, null))
      failed = proc
      return proc
    })

    const result = await wallpaperService.apply({
      kind: 'wallpaper',
      options: { backgroundId: '/wp/2', screen: 'eDP-1' },
    })

    expect(result.success).toBe(false)
    const record = supervisorService.screens().get('eDP-1')
    expect(record?.options.backgroundId).toBe('/wp/1')
    expect(record?.proc).toBeDefined()
    expect(record?.proc).not.toBe(failed)
  })
})

describe('wallpaperService.apply playlist', () => {
  it('keeps a screen that shared a backend with the playlist target on its wallpaper', async () => {
    const shared = await supervisorService.start(['--bg', '/wp/1'], {
      screens: ['eDP-1', 'HDMI-1'],
      wallpaper: { backgroundId: '/wp/1' },
      stdio: 'ignore',
    })
    mockPlaylistService.startProcess.mockImplementation(
      async (name: string, screens: string[], _stamp: boolean, launch) => {
        await launch(screens, ['--screen-root', screens[0], '--playlist', name], {
          backgroundId: '/wp/2',
        })
        return { success: true, screens }
      },
    )

    await wallpaperService.apply({
      kind: 'playlist',
      name: 'Mix',
      screens: ['eDP-1'],
      stampLastApplied: false,
    })

    const records = supervisorService.screens()
    expect(records.get('eDP-1')?.playlist).toBe('Mix')
    expect(records.get('HDMI-1')?.options.backgroundId).toBe('/wp/1')
    expect(records.get('HDMI-1')?.proc).toBeDefined()
    expect(records.get('HDMI-1')?.proc).not.toBe(shared)
    expect(records.get('HDMI-1')?.proc).not.toBe(records.get('eDP-1')?.proc)
  })
})
