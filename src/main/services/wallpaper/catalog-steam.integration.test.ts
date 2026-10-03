import { describe, expect, it, vi } from 'vite-plus/test'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { WORKSHOP_AGE_RATING_TIMEOUT } from '../../../shared/constants/workshop'
import type { WorkshopMetadataSchema } from '../store'

const mocks = vi.hoisted(() => {
  const metadata: WorkshopMetadataSchema = { ageRatings: { '123': 'g' }, checkedAt: {} }
  return { metadata, getItems: vi.fn() }
})
vi.mock('../settings', () => ({ settingsService: {} }))
vi.mock('../store', () => ({
  storeService: {
    workshopMetadata: {
      get: (key: keyof WorkshopMetadataSchema) => mocks.metadata[key],
      set: (value: WorkshopMetadataSchema) => {
        mocks.metadata = structuredClone(value)
      },
    },
  },
}))
vi.mock('steamworks.js', () => ({ init: () => ({ workshop: { getItems: mocks.getItems } }) }))
import { enrichAgeRatings } from './age-ratings'
import { WallpaperCatalogCache } from './catalog-cache'

const makeWallpaper = (): Wallpaper => ({
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
})

describe('Refresh during a stalled Steam lookup', () => {
  it('finishes after the deadline and ignores metadata returned late by the older lookup', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const stalled = Promise.withResolvers<{
        items: Array<{ publishedFileId: bigint; tags: string[] }>
      }>()
      mocks.getItems.mockReturnValueOnce(stalled.promise).mockResolvedValueOnce({
        items: [{ publishedFileId: 123n, tags: ['Mature'] }],
      })
      const cache = new WallpaperCatalogCache(async (force) => {
        const wallpapers = [makeWallpaper()]
        await enrichAgeRatings(wallpapers, force)
        return wallpapers
      })
      const oldRead = cache.get()
      cache.invalidate(true)
      const refreshRead = cache.get()
      await vi.advanceTimersByTimeAsync(WORKSHOP_AGE_RATING_TIMEOUT)
      for (const result of await Promise.all([oldRead, refreshRead])) {
        expect(result[0].ageRating).toBe('r')
      }
      expect(mocks.metadata.ageRatings['123']).toBe('r')
      // Steam finishes its native request after the caller has already timed out.
      stalled.resolve({ items: [{ publishedFileId: 123n, tags: ['Everyone'] }] })
      await vi.advanceTimersByTimeAsync(0)
      expect(mocks.metadata.ageRatings['123']).toBe('r')
      expect((await cache.get())[0].ageRating).toBe('r')
      expect(mocks.getItems).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
