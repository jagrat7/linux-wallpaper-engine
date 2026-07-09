import type { SystemPaletteKey, SystemThemePalette } from '../../shared/constants/theme'

// How omarchy's colors.toml keys map onto our palette. ANSI slots follow the
// terminal convention: color1=red, color2=green, color3=yellow, etc.
const OMARCHY_KEY_MAP: Record<string, SystemPaletteKey> = {
  background: 'background',
  foreground: 'foreground',
  accent: 'accent',
  color1: 'red',
  color2: 'green',
  color3: 'yellow',
  color4: 'blue',
  color5: 'magenta',
  color6: 'cyan',
}

// colors.toml is a flat list of `key = "#hex"` pairs, so a line scan is
// enough -- no TOML dependency needed
export function parseColorsToml(raw: string): Record<string, string> {
  const colors: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*(\w+)\s*=\s*"(#[0-9a-fA-F]{3,8})"\s*(?:#.*)?$/)
    if (match) colors[match[1]] = match[2]
  }
  return colors
}

export function toSystemPalette(colors: Record<string, string>): SystemThemePalette | null {
  const palette: Partial<Record<SystemPaletteKey, string>> = {}
  for (const [key, paletteKey] of Object.entries(OMARCHY_KEY_MAP)) {
    const value = colors[key]
    if (value !== undefined) palette[paletteKey] = value
  }

  const { background, foreground, accent } = palette
  if (background === undefined || foreground === undefined || accent === undefined)
    return null

  return { ...palette, background, foreground, accent }
}
