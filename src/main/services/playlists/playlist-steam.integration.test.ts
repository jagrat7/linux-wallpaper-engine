import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('../store', () => ({
  storeService: { activeWallpapers: { get: vi.fn(), set: vi.fn() } },
}))

vi.mock('../settings', () => ({ settingsService: {} }))

import { playlistService } from './playlist'

const temporaryRoot = await fs.mkdtemp(path.join(tmpdir(), 'linux-wallpaper-engine-steam-'))

afterAll(async () => {
  await fs.rm(temporaryRoot, { recursive: true, force: true })
})

describe('playlist service Steam discovery', () => {
  it('finds libraries and Wallpaper Engine assets through the public service API', async () => {
    const steamRoot = path.join(temporaryRoot, 'steam')
    const extraLibrary = path.join(temporaryRoot, 'extra-library')
    const assetsDir = path.join(extraLibrary, 'steamapps/common/wallpaper_engine/assets')

    await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true })
    await fs.mkdir(assetsDir, { recursive: true })
    await fs.writeFile(
      path.join(steamRoot, 'steamapps/libraryfolders.vdf'),
      `"libraryfolders" { "path" "${extraLibrary}" }`,
    )

    expect(await playlistService.resolveSteamLibraryPaths([steamRoot])).toEqual([
      steamRoot,
      extraLibrary,
    ])
    expect(await playlistService.resolveWallpaperEngineAssetsDir([steamRoot])).toBe(assetsDir)
  })

  it('passes the service instance to the private playlist runner', async () => {
    const getPlaylist = vi.spyOn(playlistService, 'getPlaylist').mockResolvedValueOnce(null)

    await expect(playlistService.startProcess('Missing', [], false, vi.fn())).resolves.toEqual({
      success: false,
      error: 'Playlist not found',
    })
    expect(getPlaylist).toHaveBeenCalledWith('Missing')
  })
})
