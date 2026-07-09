import { describe, it, expect } from 'vitest'
import { parseColorsToml, toSystemPalette } from './omarchy-theme'

const TOKYO_NIGHT_COLORS = `
accent = "#7aa2f7"
cursor = "#c0caf5"
foreground = "#a9b1d6"
background = "#1a1b26"
selection_foreground = "#c0caf5"
selection_background = "#7aa2f7"

color0 = "#32344a"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#ad8ee6"
color6 = "#449dab"
color7 = "#787c99"
`

describe('parseColorsToml', () => {
  it('parses flat key/hex pairs', () => {
    const colors = parseColorsToml(TOKYO_NIGHT_COLORS)
    expect(colors.accent).toBe('#7aa2f7')
    expect(colors.background).toBe('#1a1b26')
    expect(colors.color1).toBe('#f7768e')
  })

  it('ignores lines that are not hex color assignments', () => {
    const colors = parseColorsToml('name = "tokyo"\n# comment\naccent = "#fff"')
    expect(colors).toEqual({ accent: '#fff' })
  })
})

describe('toSystemPalette', () => {
  it('maps omarchy keys onto the system palette', () => {
    const palette = toSystemPalette(parseColorsToml(TOKYO_NIGHT_COLORS))
    expect(palette).toMatchObject({
      background: '#1a1b26',
      foreground: '#a9b1d6',
      accent: '#7aa2f7',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#ad8ee6',
      cyan: '#449dab',
    })
  })

  it('returns null when required colors are missing', () => {
    expect(toSystemPalette({ accent: '#fff' })).toBeNull()
  })

  it('omits missing optional ansi colors', () => {
    const palette = toSystemPalette({
      background: '#000',
      foreground: '#fff',
      accent: '#7aa2f7',
    })
    expect(palette).toEqual({
      background: '#000',
      foreground: '#fff',
      accent: '#7aa2f7',
    })
  })
})
