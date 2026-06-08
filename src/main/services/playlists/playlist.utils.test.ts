import { describe, expect, it } from 'vitest'
import { shuffleItemsForRandomStart } from './playlist.utils'

describe('shuffleItemsForRandomStart', () => {
  it('keeps a single item unchanged', () => {
    expect(shuffleItemsForRandomStart(['one'], () => 0)).toEqual(['one'])
  })

  it('produces a deterministic permutation for given random indexes without mutating the input', () => {
    const items = ['first', 'second', 'third']
    const randomIndexes = [0, 1]

    const result = shuffleItemsForRandomStart(items, () => randomIndexes.shift() ?? 0)

    expect(result).toEqual(['third', 'second', 'first'])
    expect(items).toEqual(['first', 'second', 'third'])
  })

  it('gives every item a chance at the front, including the original first', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const firstCounts = new Map<string, number>()

    for (let i = 0; i < 20000; i++) {
      const first = shuffleItemsForRandomStart(items)[0]
      firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1)
    }

    for (const item of items) {
      expect(firstCounts.get(item) ?? 0).toBeGreaterThan(0)
    }
  })
})
