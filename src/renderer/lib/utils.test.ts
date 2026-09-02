import { describe, expect, it } from 'vitest'
import { columnsForWidth } from './utils'

describe('columnsForWidth', () => {
  it.each([
    ['compact', 630, 3],
    ['medium', 630, 2],
    ['large', 630, 1],
  ] as const)('uses the %s grid density', (density, width, expected) => {
    expect(columnsForWidth(width, density)).toBe(expected)
  })

  it('caps the grid at six columns', () => {
    expect(columnsForWidth(5000, 'compact')).toBe(6)
  })

  it('always renders at least one column', () => {
    expect(columnsForWidth(0, 'large')).toBe(1)
  })

  it('keeps two medium cards beside the details panel at the workshop width', () => {
    expect(columnsForWidth(464, 'medium')).toBe(2)
  })
})
