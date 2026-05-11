import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { resolveSteamLibraryPaths, resolveWallpaperEngineAssetsDir } from './wallpaper.utils'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}))

const mockReadFile = vi.mocked(fs.readFile)
const mockAccess = vi.mocked(fs.access)

describe('resolveSteamLibraryPaths', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockAccess.mockReset()
  })

  it('includes Steam libraries from libraryfolders.vdf', async () => {
    mockReadFile.mockResolvedValueOnce(`
"libraryfolders"
{
  "0"
  {
    "path" "/home/user/.local/share/Steam"
  }
  "1"
  {
    "path" "/some/other/folder/Steam"
  }
}
`)

    const paths = await resolveSteamLibraryPaths(['~/.local/share/Steam'])

    expect(paths).toContain('/home/user/.local/share/Steam')
    expect(paths).toContain('/some/other/folder/Steam')
  })

  it('keeps default paths when libraryfolders.vdf is missing', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))

    await expect(resolveSteamLibraryPaths(['/steam'])).resolves.toEqual(['/steam'])
  })
})

describe('resolveWallpaperEngineAssetsDir', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockAccess.mockReset()
  })

  it('finds Wallpaper Engine assets in a Steam library', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))
    mockAccess.mockResolvedValueOnce(undefined)

    await expect(resolveWallpaperEngineAssetsDir(['/steam'])).resolves.toBe('/steam/steamapps/common/wallpaper_engine/assets')
  })

  it('returns null when no assets folder exists', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('missing'))
    mockAccess.mockRejectedValueOnce(new Error('missing'))

    await expect(resolveWallpaperEngineAssetsDir(['/steam'])).resolves.toBeNull()
  })
})
