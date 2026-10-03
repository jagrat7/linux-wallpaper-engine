import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WORKSHOP_AGE_RATING_TIMEOUT } from '../../../shared/constants/workshop'

const getItems = vi.hoisted(() => vi.fn())
vi.mock('../settings', () => ({ settingsService: {} }))
vi.mock('steamworks.js', () => ({ init: () => ({ workshop: { getItems } }) }))
import { workshopService } from './workshop'

beforeEach(() => {
  getItems.mockReset()
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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

  it('returns completed batches on timeout without accepting late results or starting further batches', async () => {
    const lateRequest = Promise.withResolvers<{
      items: Array<{ publishedFileId: bigint; tags: string[] }>
    }>()
    getItems
      .mockResolvedValueOnce({
        items: Array.from({ length: 1000 }, (_value, index) => ({
          publishedFileId: BigInt(index + 1),
          tags: ['Everyone'],
        })),
      })
      .mockReturnValueOnce(lateRequest.promise)
    const lookup = workshopService.getAgeRatings(
      Array.from({ length: 2001 }, (_value, index) => String(index + 1)),
    )
    await vi.advanceTimersByTimeAsync(WORKSHOP_AGE_RATING_TIMEOUT)
    const ratings = await lookup
    expect(Object.keys(ratings)).toHaveLength(1000)
    expect(ratings['1']).toBe('g')
    expect(ratings['1001']).toBeUndefined()
    lateRequest.resolve({ items: [{ publishedFileId: 1001n, tags: ['Mature'] }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(ratings['1001']).toBeUndefined()
    expect(getItems).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps completed unclassified items when a subsequent batch fails', async () => {
    getItems
      .mockResolvedValueOnce({ items: [{ publishedFileId: 1n, tags: [] }] })
      .mockRejectedValueOnce(new Error('Steam request failed'))
    await expect(
      workshopService.getAgeRatings(
        Array.from({ length: 1001 }, (_value, index) => String(index + 1)),
      ),
    ).resolves.toEqual({ '1': null })
    expect(vi.getTimerCount()).toBe(0)
  })
})
