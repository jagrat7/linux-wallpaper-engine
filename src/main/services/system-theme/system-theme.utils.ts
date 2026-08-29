import { readFileSync } from 'node:fs'
import type { SystemTheme } from './system-theme.types'

export const HEX_COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i

export const readText = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

export const subtleSidebarColor = (
  accent: string | undefined,
  background?: string,
): string | undefined => accent === undefined
  ? undefined
  : `color-mix(in oklch, ${accent} 22%, ${background ?? 'var(--sidebar)'})`

export const inferScheme = (background: string | undefined): SystemTheme['scheme'] | null => {
  if (background === undefined) return null
  const hex = background.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i)
  const functional = background.match(/(?:rgb|color\(srgb)\(?\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/)
  const channels = hex !== null
    ? hex.slice(1).map((value) => Number.parseInt(value, 16) / 255)
    : functional?.slice(1).map(Number)
  if (channels === undefined || channels.length < 3) return null
  const [red, green, blue] = channels.map((value) => value > 1 ? value / 255 : value)
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 0.5 ? 'dark' : 'light'
}
