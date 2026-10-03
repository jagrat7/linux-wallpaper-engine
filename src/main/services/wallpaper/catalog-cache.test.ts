import { describe, expect, it, vi } from 'vite-plus/test'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { WallpaperCatalogCache } from './catalog-cache'

const makeWallpaper = (ageRating: Wallpaper['ageRating']): Wallpaper => ({
  id: '123',
  title: 'Test',
  author: 'Test',
  type: 'scene',
  thumbnail: '',
  resolution: { width: 0, height: 0 },
  fileSize: 0,
  dateAdded: 0,
  tags: [],
  installed: true,
  path: '/wallpapers/123',
  ageRating,
})

describe('wallpaper catalog concurrency', () => {
  it('preserves a forced refresh request after discovery fails', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('discovery failed'))
      .mockResolvedValueOnce([makeWallpaper('r')])
    const cache = new WallpaperCatalogCache(load)
    cache.invalidate(true)
    await expect(cache.get()).rejects.toThrow('discovery failed')
    expect((await cache.get())[0].ageRating).toBe('r')
    expect(load.mock.calls).toEqual([[true], [true]])
  })
})
