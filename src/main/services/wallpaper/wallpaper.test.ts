import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
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
    getActivePlaylistEntries: vi.fn(() => ({})),
    clearActivePlaylist: vi.fn(),
  },
}))

vi.mock('../store', () => ({
  storeService: { activeWallpapers: mockStore, wallpaperOverrides: mockStore },
}))
vi.mock('../playlists/playlist', () => ({ playlistService: mockPlaylistService }))
vi.mock('../settings', () => ({
  settingsService: { loadSettings: vi.fn(), getSetting: vi.fn() },
}))
vi.mock('../display', () => ({ displayService: { detectDisplays: vi.fn() } }))
vi.mock('../compatibility', () => ({ compatibilityService: { monitorProcess: vi.fn() } }))
vi.mock('../invalidation', () => ({ invalidationService: { emit: vi.fn() } }))
vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  // `du` for sizes, `file` for resolutions; empty output is fine for these tests
  hostExecFileAsync: vi.fn(async () => ({ stdout: '', stderr: '' })),
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

beforeEach(async () => {
  vi.clearAllMocks()
  mockPlaylistService.resolveSteamLibraryPaths.mockResolvedValue([library])
  supervisorService.reset()
  await wallpaperService.diagnose({ kind: 'invalidateCache' })
})

// --- Tests ---------------------------------------------------------------

describe('wallpaperService catalog', () => {
  it('shares one library scan between callers that arrive while it runs', async () => {
    const results = await Promise.all([
      wallpaperService.catalog(),
      wallpaperService.query(),
      wallpaperService.catalog(),
    ])

    expect(mockPlaylistService.resolveSteamLibraryPaths).toHaveBeenCalledOnce()
    expect(results[0].map((w) => w.title)).toEqual(['Forest Stream'])
    expect(results[1].wallpapers).toBe(results[0])
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
    supervisorService.spawnFor(['eDP-1'], { backgroundId: wallpaperPath }, [], { stdio: 'ignore' })

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

describe('wallpaperService.getActive during restore', () => {
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
