import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ChildProcess } from 'node:child_process'
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
import { wallpaperStateManager } from './state-manager/state-manager'

const makeProc = () => ({ kill: vi.fn() }) as unknown as ChildProcess

beforeEach(async () => {
  vi.clearAllMocks()
  mockPlaylistService.resolveSteamLibraryPaths.mockResolvedValue([library])
  wallpaperStateManager.reset()
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
    wallpaperStateManager.register(['eDP-1'], makeProc(), { backgroundId: wallpaperPath })

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
