import { readFileSync, unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { invalidationService } from './invalidation'

const OMARCHY_THEME_PATH = path.join(
  homedir(),
  '.config/omarchy/current/theme/colors.toml',
)
const COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i
const WATCH_INTERVAL_MS = 1000

const PALETTE_KEYS = [
  'accent',
  'background',
  'foreground',
  'selection_background',
  'selection_foreground',
  'color0',
  'color1',
  'color2',
  'color3',
  'color7',
  'color8',
] as const

type PaletteKey = typeof PALETTE_KEYS[number]

export type SystemThemePalette = Partial<Record<PaletteKey, string>>

const parsePalette = (source: string): SystemThemePalette => {
  const palette: SystemThemePalette = {}

  source.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w]+)\s*=\s*["']([^"']+)["']/)
    if (match === null) return

    const key = match[1] as PaletteKey
    const value = match[2]
    if (PALETTE_KEYS.includes(key) && COLOR_PATTERN.test(value))
      palette[key] = value
  })

  return palette
}

const readPalette = (): SystemThemePalette | null => {
  try {
    const palette = parsePalette(readFileSync(OMARCHY_THEME_PATH, 'utf8'))
    return palette.background !== undefined && palette.foreground !== undefined
      ? palette
      : null
  } catch {
    return null
  }
}

let watching = false

export const systemThemeService = {
  getPalette: readPalette,
  startWatching() {
    if (watching) return
    watching = true
    watchFile(OMARCHY_THEME_PATH, { interval: WATCH_INTERVAL_MS }, () => {
      invalidationService.emit('settings.systemTheme')
    })
  },
  stopWatching() {
    if (!watching) return
    unwatchFile(OMARCHY_THEME_PATH)
    watching = false
  },
}
