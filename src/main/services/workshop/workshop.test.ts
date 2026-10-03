import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WORKSHOP_AGE_RATING_TIMEOUT } from '../../../shared/constants/workshop'

const getItems = vi.hoisted(() => vi.fn())
vi.mock('../settings', () => ({ settingsService: {} }))
vi.mock('steamworks.js', () => ({ init: () => ({ workshop: { getItems } }) }))
import { workshopService } from './workshop'

beforeEach(() => {
  getItems.mockReset()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('Steam metadata deadline', () => {
  it('maps successful metadata and clears its deadline timer', async () => {
    getItems.mockResolvedValue({ items: [{ publishedFileId: 123n, tags: ['Everyone'] }] })
    await expect(workshopService.getAgeRatings(['123'])).resolves.toEqual({ '123': 'g' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a stalled Steam request and permits a subsequent lookup', async () => {
    getItems.mockReturnValueOnce(new Promise(() => {}))
    const stalled = workshopService.getAgeRatings(['123'])
    const rejected = expect(stalled).rejects.toThrow('Steam age-rating lookup timed out')
    await vi.advanceTimersByTimeAsync(WORKSHOP_AGE_RATING_TIMEOUT)
    await rejected
    getItems.mockResolvedValue({ items: [{ publishedFileId: 123n, tags: ['Mature'] }] })
    await expect(workshopService.getAgeRatings(['123'])).resolves.toEqual({ '123': 'r' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start another batch after a timed-out native request resolves late', async () => {
    const lateRequest = Promise.withResolvers<{ items: [] }>()
    getItems.mockReturnValueOnce(lateRequest.promise)
    const lookup = workshopService.getAgeRatings(
      Array.from({ length: 1001 }, (_value, index) => String(index + 1)),
    )
    const rejected = expect(lookup).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(WORKSHOP_AGE_RATING_TIMEOUT)
    await rejected
    lateRequest.resolve({ items: [] })
    await vi.advanceTimersByTimeAsync(0)
    expect(getItems).toHaveBeenCalledTimes(1)
  })
})
