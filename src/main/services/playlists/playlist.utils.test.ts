import { describe, expect, it } from 'vitest'
import { experimentalRandomizeStartItem } from './playlist.utils'

describe('experimentalRandomizeStartItem', () => {
  it('leaves non-random playlists untouched', () => {
    const items = ['a', 'b', 'c']
    const result = experimentalRandomizeStartItem(items, 'sequential')
    expect(result).toBe(items)
  })

  it('leaves single-item random playlists untouched', () => {
    const items = ['only']
    const result = experimentalRandomizeStartItem(items, 'random')
    expect(result).toBe(items)
  })

  it('shuffles random playlists without mutating the input', () => {
    const items = ['first', 'second', 'third']
    const randomIndexes = [0, 1]

    const result = experimentalRandomizeStartItem(items, 'random', () => randomIndexes.shift() ?? 0)

    expect(result).toEqual(['third', 'second', 'first'])
    expect(items).toEqual(['first', 'second', 'third'])
    expect(result).not.toBe(items)
  })

  it('gives every item a chance at the front, including the original first', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const firstCounts = new Map<string, number>()

    for (let i = 0; i < 20000; i++) {
      const first = experimentalRandomizeStartItem(items, 'random')[0]
      firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1)
    }

    for (const item of items) {
      expect(firstCounts.get(item) ?? 0).toBeGreaterThan(0)
    }
  })
})
