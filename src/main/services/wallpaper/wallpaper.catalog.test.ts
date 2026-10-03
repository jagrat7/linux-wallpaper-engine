import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect, it, vi } from 'vite-plus/test'
import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'

const { hostCommandExists } = vi.hoisted(() => ({ hostCommandExists: vi.fn(async () => true) }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('electron-store', () => ({
  default: class {
    store: Record<string, unknown>
    constructor(options: { defaults: Record<string, unknown> }) {
      this.store = structuredClone(options.defaults)
    }
    get(key: string) {
      return this.store[key]
    }
    set(key: string, value: unknown) {
      this.store[key] = value
    }
  },
}))
vi.mock('../../utils/host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/host')>()),
  hostCommandExists,
  hostExecAsync: async () => ({ stdout: '0\t', stderr: '' }),
}))

const home = await fs.mkdtemp(path.join(tmpdir(), 'lwe-catalog-'))
const library = path.join(home, 'library')
const workshop = path.join(library, 'steamapps/workshop/content', String(WALLPAPER_ENGINE_APP_ID))
afterAll(async () => {
  vi.unstubAllEnvs()
  await fs.rm(home, { recursive: true, force: true })
})

// Prepare the item elsewhere and move it in, as a finished download appears at once.
async function install(id: string, title: string) {
  const staged = path.join(home, 'staging', id)
  await fs.mkdir(staged, { recursive: true })
  await fs.writeFile(path.join(staged, 'preview.jpg'), '')
  await fs.writeFile(
    path.join(staged, 'project.json'),
    JSON.stringify({ title, preview: 'preview.jpg', type: 'scene' }),
  )
  await fs.mkdir(workshop, { recursive: true })
  await fs.rename(staged, path.join(workshop, id))
}

it('lists the scanned catalog without probing the backend and follows library changes', async () => {
  vi.stubEnv('LWE_DEV_WEB', '1')
  vi.stubEnv('HOME', home)
  await install('1', 'Aurora')
  const { playlistService } = await import('../playlists/playlist')
  const { wallpaperService } = await import('./wallpaper')
  Object.assign(playlistService, {
    resolveSteamLibraryPaths: async () => [library],
  } satisfies Pick<typeof playlistService, 'resolveSteamLibraryPaths'>)
  const titles = async () => (await wallpaperService.catalog()).map((item) => item.title)
  try {
    expect(await titles()).toEqual(['Aurora'])
    await install('2', 'Borealis')
    await vi.waitFor(async () => expect(await titles()).toEqual(['Aurora', 'Borealis']), {
      timeout: 5000,
    })
    expect(hostCommandExists).not.toHaveBeenCalled()

    const { wallpapers, backendInstalled } = await wallpaperService.query()
    expect(wallpapers).toEqual(await wallpaperService.catalog())
    expect(backendInstalled).toBe(true)
    expect(hostCommandExists).toHaveBeenCalledOnce()
  } finally {
    await wallpaperService.diagnose({ kind: 'cleanup' })
  }
})
