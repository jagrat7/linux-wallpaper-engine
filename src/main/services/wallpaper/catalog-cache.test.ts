import { describe, expect, it, vi } from 'vite-plus/test'
import { CACHE_TTL } from '../../../shared/constants/app'
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
  it('shares a pending scan between simultaneous readers', async () => {
    const scan = Promise.withResolvers<Wallpaper[]>()
    const load = vi.fn().mockReturnValue(scan.promise)
    const cache = new WallpaperCatalogCache(load)
    const first = cache.get()
    const second = cache.get()
    expect(first).toBe(second)
    expect(load).toHaveBeenCalledTimes(1)
    scan.resolve([makeWallpaper('g')])
    expect(await first).toEqual(await second)
  })

  it('queues a forced refresh when invalidation overlaps an older scan', async () => {
    const oldScan = Promise.withResolvers<Wallpaper[]>()
    const load = vi
      .fn()
      .mockReturnValueOnce(oldScan.promise)
      .mockResolvedValueOnce([makeWallpaper('r')])
    const cache = new WallpaperCatalogCache(load)
    const initialRead = cache.get()
    cache.invalidate(true)
    const refreshRead = cache.get()
    const otherRead = cache.get()
    oldScan.resolve([makeWallpaper('g')])
    for (const result of await Promise.all([initialRead, refreshRead, otherRead])) {
      expect(result[0].ageRating).toBe('r')
    }
    expect(load.mock.calls).toEqual([[false], [true]])
    expect((await cache.get())[0].ageRating).toBe('r')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('shares the forced scan between Refresh and another catalog read', async () => {
    const forcedScan = Promise.withResolvers<Wallpaper[]>()
    const load = vi
      .fn()
      .mockResolvedValueOnce([makeWallpaper('g')])
      .mockReturnValueOnce(forcedScan.promise)
    const cache = new WallpaperCatalogCache(load)
    await cache.get()
    cache.invalidate(true)
    const refreshRead = cache.get()
    const otherRead = cache.get()
    expect(refreshRead).toBe(otherRead)
    forcedScan.resolve([makeWallpaper('r')])
    expect((await refreshRead)[0].ageRating).toBe('r')
    expect((await otherRead)[0].ageRating).toBe('r')
    expect((await cache.get())[0].ageRating).toBe('r')
    expect(load.mock.calls).toEqual([[false], [true]])
  })

  it('retries after a failed scan rather than retaining a rejected promise', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('scan failed')).mockResolvedValueOnce([])
    const cache = new WallpaperCatalogCache(load)
    await expect(cache.get()).rejects.toThrow('scan failed')
    await expect(cache.get()).resolves.toEqual([])
    expect(load).toHaveBeenCalledTimes(2)
  })

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

  it('expires the catalog independently of the longer metadata cache', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    try {
      const load = vi.fn().mockResolvedValue([])
      const cache = new WallpaperCatalogCache(load)
      await cache.get()
      await cache.get()
      expect(load).toHaveBeenCalledTimes(1)
      clock.mockReturnValue(CACHE_TTL + 1)
      await cache.get()
      expect(load).toHaveBeenCalledTimes(2)
    } finally {
      clock.mockRestore()
    }
  })
})
