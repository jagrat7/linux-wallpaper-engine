import { describe, expect, it } from 'vitest'
import { normalizeSystemThemePalette } from './system-theme.utils'

describe('normalizeSystemThemePalette', () => {
  it('removes empty palette values while preserving usable colors', () => {
    expect(normalizeSystemThemePalette({
      background: '#101010',
      foreground: '',
      accent: undefined,
    })).toEqual({ background: '#101010' })
  })

  it('preserves a usable partial palette', () => {
    expect(normalizeSystemThemePalette({ accent: '#336699' })).toEqual({ accent: '#336699' })
  })

  it('rejects empty and missing palettes', () => {
    expect(normalizeSystemThemePalette({ background: '' })).toBeNull()
    expect(normalizeSystemThemePalette(null)).toBeNull()
  })
})
