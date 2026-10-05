import { beforeEach, expect, it, vi } from 'vite-plus/test'
import type { WorkshopAgeRatings } from '../../../shared/constants/wallpaper'

const mocks = vi.hoisted(() => ({
  ratings: {} as WorkshopAgeRatings,
  subscribe: vi.fn(),
  download: vi.fn(),
  set: vi.fn(),
}))
vi.mock('../settings', () => ({ settingsService: {} }))
vi.mock('../store', () => ({
  storeService: {
    workshopMetadata: { get: () => mocks.ratings, set: mocks.set },
  },
}))
vi.mock('steamworks.js', () => ({
  init: () => ({ workshop: { subscribe: mocks.subscribe, download: mocks.download } }),
}))
import { workshopService } from './workshop'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.ratings = {}
  mocks.subscribe.mockResolvedValue(undefined)
  mocks.download.mockReturnValue(true)
  mocks.set.mockImplementation((_key, ratings) => {
    mocks.ratings = ratings
  })
})

it('saves download ratings once, including unclassified items, without replacing saved ratings', async () => {
  expect(await workshopService.subscribe('123', 'pg13')).toBe(true)
  expect(await workshopService.subscribe('456', null)).toBe(true)
  expect(mocks.ratings).toEqual({ '123': 'pg13', '456': null })
  await workshopService.subscribe('123', 'g')
  await workshopService.subscribe('456', 'r')
  expect(mocks.set).toHaveBeenCalledTimes(2)
  expect(mocks.ratings).toEqual({ '123': 'pg13', '456': null })
  expect(mocks.download).toHaveBeenCalledWith(123n, true)
})

it('does not save ratings when subscribing or starting the download fails', async () => {
  mocks.subscribe.mockRejectedValueOnce(new Error('Steam unavailable'))
  expect(await workshopService.subscribe('123', 'r')).toBe(false)
  mocks.download.mockReturnValue(false)
  expect(await workshopService.subscribe('123', 'r')).toBe(false)
  expect(mocks.set).not.toHaveBeenCalled()
})
