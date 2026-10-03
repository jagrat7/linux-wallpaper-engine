import { beforeEach, afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { WORKSHOP_AGE_RATING_TTL } from '../../../shared/constants/workshop'
import type { WorkshopMetadataSchema } from '../store'

const mocks = vi.hoisted(() => {
  const metadata: WorkshopMetadataSchema = { ageRatings: {}, checkedAt: {} }
  return { metadata, get: vi.fn(), set: vi.fn(), fetch: vi.fn() }
})
vi.mock('../store', () => ({
  storeService: { workshopMetadata: { get: mocks.get, set: mocks.set } },
}))
vi.mock('../workshop/workshop', () => ({ workshopService: { getAgeRatings: mocks.fetch } }))

import { enrichAgeRatings } from './age-ratings'

const now = 2 * WORKSHOP_AGE_RATING_TTL
const makeWallpaper = (): Wallpaper => ({
  id: '123',
  workshopId: '123',
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

beforeEach(() => {
  vi.resetAllMocks()
  mocks.metadata = { ageRatings: {}, checkedAt: {} }
  mocks.get.mockImplementation((key: 'ageRatings' | 'checkedAt') => mocks.metadata[key])
  mocks.set.mockImplementation((value) => {
    mocks.metadata = structuredClone(value)
  })
  vi.spyOn(Date, 'now').mockReturnValue(now)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('installed wallpaper age metadata', () => {
  it('refreshes stored ratings on expiry or manual Refresh without refetching fresh ratings', async () => {
    mocks.metadata = { ageRatings: { '123': 'g' }, checkedAt: { '123': now } }
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBe('g')
    expect(mocks.fetch).not.toHaveBeenCalled()

    mocks.metadata.checkedAt['123'] = now - WORKSHOP_AGE_RATING_TTL
    mocks.fetch.mockResolvedValue({ '123': 'pg13' })
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBe('pg13')
    expect(mocks.metadata.checkedAt['123']).toBe(now)

    mocks.fetch.mockResolvedValue({ '123': 'r' })
    await enrichAgeRatings([wallpaper], true)
    expect(wallpaper.ageRating).toBe('r')
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('clears a removed rating and remembers that the item was checked', async () => {
    mocks.metadata.ageRatings['123'] = 'r'
    mocks.fetch.mockResolvedValue({ '123': null })
    const wallpaper = { ...makeWallpaper(), ageRating: 'r' as const }
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBeUndefined()
    expect(mocks.metadata.ageRatings['123']).toBeNull()
    await enrichAgeRatings([makeWallpaper()])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
