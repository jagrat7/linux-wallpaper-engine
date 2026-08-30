import { describe, expect, it } from 'vitest'
import type { ThemeContribution } from './system-theme.types'
import { normalizeThemeContribution } from './system-theme.utils'

describe('normalizeThemeContribution', () => {
  it('removes empty palette values while preserving usable colors', () => {
    expect(normalizeThemeContribution({
      scheme: 'dark',
      palette: {
        background: '#101010',
        foreground: '',
        accent: undefined,
      },
    })).toEqual({
      scheme: 'dark',
      palette: { background: '#101010' },
    })
  })

  it('accepts scheme-only and palette-only contributions', () => {
    expect(normalizeThemeContribution({ scheme: 'light' })).toEqual({ scheme: 'light' })
    expect(normalizeThemeContribution({ palette: { accent: '#336699' } })).toEqual({
      palette: { accent: '#336699' },
    })
  })

  it('rejects a contribution with no usable information', () => {
    const empty = { palette: { background: '' } } as ThemeContribution
    expect(normalizeThemeContribution(empty)).toBeNull()
  })
})
