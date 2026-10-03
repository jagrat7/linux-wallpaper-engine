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

const makeWallpaper = (id = '123'): Wallpaper => ({
  id,
  title: 'Test',
  author: 'Test',
  type: 'scene',
  thumbnail: '',
  resolution: { width: 0, height: 0 },
  fileSize: 0,
  dateAdded: 0,
  tags: [],
  installed: true,
  path: `/wallpapers/${id}`,
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

  it('persists completed batches and retries only the remaining wallpapers on the next scan', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.metadata = { ageRatings: {}, checkedAt: {} }
    mocks.getItems.mockReset()
    try {
      const lateRequest = Promise.withResolvers<{
        items: Array<{ publishedFileId: bigint; tags: string[] }>
      }>()
      const wallpapers = Array.from({ length: 1001 }, (_value, index) =>
        makeWallpaper(String(index + 1)),
      )
      mocks.getItems
        .mockResolvedValueOnce({
          items: Array.from({ length: 1000 }, (_value, index) => ({
            publishedFileId: BigInt(index + 1),
            tags: ['Everyone'],
          })),
        })
        .mockReturnValueOnce(lateRequest.promise)
      const firstScan = enrichAgeRatings(wallpapers)
      await vi.advanceTimersByTimeAsync(WORKSHOP_AGE_RATING_TIMEOUT)
      await firstScan
      expect(Object.keys(mocks.metadata.checkedAt)).toHaveLength(1000)
      expect(wallpapers[0].ageRating).toBe('g')
      expect(mocks.metadata.checkedAt['1001']).toBeUndefined()
      mocks.getItems.mockResolvedValueOnce({
        items: [{ publishedFileId: 1001n, tags: ['Mature'] }],
      })
      await enrichAgeRatings(wallpapers)
      expect(mocks.getItems).toHaveBeenNthCalledWith(3, [1001n])
      expect(wallpapers[1000].ageRating).toBe('r')
      expect(Object.keys(mocks.metadata.checkedAt)).toHaveLength(1001)
      lateRequest.resolve({ items: [{ publishedFileId: 1001n, tags: ['Questionable'] }] })
      await vi.advanceTimersByTimeAsync(0)
      expect(mocks.metadata.ageRatings['1001']).toBe('r')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
