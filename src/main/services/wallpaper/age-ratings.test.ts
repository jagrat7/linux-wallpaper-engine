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
  it('refreshes legacy ratings without timestamps', async () => {
    mocks.metadata.ageRatings['123'] = 'g'
    mocks.fetch.mockResolvedValue({ '123': 'r' })
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper])
    expect(mocks.fetch).toHaveBeenCalledWith(['123'])
    expect(wallpaper.ageRating).toBe('r')
    expect(mocks.metadata.checkedAt['123']).toBe(now)
  })

  it('uses fresh stored ratings without another Steam request', async () => {
    mocks.metadata = { ageRatings: { '123': 'g' }, checkedAt: { '123': now } }
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBe('g')
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('updates ratings at cache expiry', async () => {
    mocks.metadata = {
      ageRatings: { '123': 'g' },
      checkedAt: { '123': now - WORKSHOP_AGE_RATING_TTL },
    }
    mocks.fetch.mockResolvedValue({ '123': 'pg13' })
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBe('pg13')
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

  it('retries an item omitted from the Steam response', async () => {
    mocks.fetch.mockResolvedValue({})
    await enrichAgeRatings([makeWallpaper()])
    expect(mocks.metadata.checkedAt['123']).toBeUndefined()
    await enrichAgeRatings([makeWallpaper()])
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('manual refresh bypasses a fresh metadata cache', async () => {
    mocks.metadata = { ageRatings: { '123': 'g' }, checkedAt: { '123': now } }
    mocks.fetch.mockResolvedValue({ '123': 'r' })
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper], true)
    expect(wallpaper.ageRating).toBe('r')
  })

  it('preserves stale cached ratings when Steam is unavailable', async () => {
    mocks.metadata.ageRatings['123'] = 'r'
    mocks.fetch.mockRejectedValue(new Error('Steam unavailable'))
    const wallpaper = makeWallpaper()
    await enrichAgeRatings([wallpaper])
    expect(wallpaper.ageRating).toBe('r')
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.metadata.checkedAt['123']).toBeUndefined()
  })
})
