import { describe, expect, it } from 'vitest'
import { mapWorkshopAgeRatings, parseWorkshopAgeRating } from './workshop.utils'

describe('parseWorkshopAgeRating', () => {
  it("returns 'g' for the Everyone tag", () => {
    expect(parseWorkshopAgeRating(['Scene', 'Everyone'])).toBe('g')
  })

  it("returns 'pg13' for the Questionable tag", () => {
    expect(parseWorkshopAgeRating(['Video', 'Questionable'])).toBe('pg13')
  })

  it("returns 'r' for the Mature tag", () => {
    expect(parseWorkshopAgeRating(['Web', 'Mature'])).toBe('r')
  })

  it('matches tags case-insensitively', () => {
    expect(parseWorkshopAgeRating(['scene', 'mAtUrE'])).toBe('r')
  })

  it('returns undefined for empty or unmatched tags', () => {
    expect(parseWorkshopAgeRating([])).toBeUndefined()
    expect(parseWorkshopAgeRating(['Scene', '4K Ultra HD'])).toBeUndefined()
  })
})

describe('mapWorkshopAgeRatings', () => {
  it('maps a single item id to its resolved age rating', () => {
    const ratings = mapWorkshopAgeRatings([{ publishedFileId: BigInt('123'), tags: ['Scene', 'Everyone'] }])
    expect(ratings).toEqual({ '123': 'g' })
  })

  it('skips null and undefined items', () => {
    const ratings = mapWorkshopAgeRatings([
      { publishedFileId: BigInt('123'), tags: ['Scene', 'Everyone'] },
      null,
      undefined,
    ])
    expect(ratings).toEqual({ '123': 'g' })
  })

  it('skips items with no matching rating tag', () => {
    const ratings = mapWorkshopAgeRatings([{ publishedFileId: BigInt('456'), tags: ['Scene', '4K Ultra HD'] }])
    expect(ratings).toEqual({})
  })

  it('maps multiple items', () => {
    const ratings = mapWorkshopAgeRatings([
      { publishedFileId: BigInt('123'), tags: ['Scene', 'Everyone'] },
      { publishedFileId: BigInt('789'), tags: ['Video', 'Questionable'] },
    ])
    expect(ratings).toEqual({ '123': 'g', '789': 'pg13' })
  })
})
