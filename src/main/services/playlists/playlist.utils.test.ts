import { describe, expect, it } from 'vitest'
import { shuffleItemsForRandomStart } from './playlist.utils'

describe('shuffleItemsForRandomStart', () => {
  it('keeps a single item unchanged', () => {
    expect(shuffleItemsForRandomStart(['one'], () => 0)).toEqual(['one'])
  })

  it('moves a non-leading item to the front when the shuffle leaves the first item first', () => {
    const items = ['first', 'second', 'third']
    const randomIndexes = [0, 0, 1]

    const result = shuffleItemsForRandomStart(items, () => randomIndexes.shift() ?? 0)

    expect(result[0]).toBe('second')
    expect(result).toEqual(expect.arrayContaining(items))
    expect(items).toEqual(['first', 'second', 'third'])
  })

  it('returns a shuffled copy when the first item already changes', () => {
    const items = ['first', 'second', 'third']
    const randomIndexes = [0, 1]

    const result = shuffleItemsForRandomStart(items, () => randomIndexes.shift() ?? 0)

    expect(result).toEqual(['third', 'second', 'first'])
    expect(items).toEqual(['first', 'second', 'third'])
  })
})
