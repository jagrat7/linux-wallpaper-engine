import * as fs from 'node:fs/promises'
import { homedir } from 'node:os'
import * as path from 'node:path'

export type SystemThemeSource = 'omarchy' | 'pywal'

export type SystemThemePalette = {
  source: SystemThemeSource
  accent: string
}

type ReadFile = (filePath: string, encoding: 'utf8') => Promise<string>

type SystemThemeOptions = {
  homeDir?: string
  cacheDir?: string
  readFile?: ReadFile
}

const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i
const TOML_COLOR_PATTERN = /^\s*([a-z_]+)\s*=\s*["'](#[\da-f]{3,8})["']\s*$/gim

const normalizeColor = (value: unknown): string | null => {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) return null

  const color = value.toLowerCase()
  if (color.length === 4) {
    return `#${color.slice(1).split('').map((channel) => channel.repeat(2)).join('')}`
  }

  return color
}

const parseOmarchyPalette = (contents: string): Omit<SystemThemePalette, 'source'> | null => {
  const colors = new Map<string, string>()

  for (const match of contents.matchAll(TOML_COLOR_PATTERN)) {
    const color = normalizeColor(match[2])
    if (color) colors.set(match[1].toLowerCase(), color)
  }

  const background = colors.get('background')
  const foreground = colors.get('foreground')
  const accent = colors.get('accent') ?? colors.get('color4')

  return background && foreground && accent
    ? { accent }
    : null
}

const parsePywalPalette = (contents: string): Omit<SystemThemePalette, 'source'> | null => {
  try {
    const data: unknown = JSON.parse(contents)
    if (!data || typeof data !== 'object') return null

    const { special, colors } = data as {
      special?: { background?: unknown, foreground?: unknown }
      colors?: { color4?: unknown }
    }
    const background = normalizeColor(special?.background)
    const foreground = normalizeColor(special?.foreground)
    const accent = normalizeColor(colors?.color4)

    return background && foreground && accent
      ? { accent }
      : null
  } catch {
    return null
  }
}

export const getSystemThemePalette = async ({
  homeDir = homedir(),
  cacheDir = process.env.XDG_CACHE_HOME ?? path.join(homeDir, '.cache'),
  readFile = (filePath) => fs.readFile(filePath, 'utf8'),
}: SystemThemeOptions = {}): Promise<SystemThemePalette | null> => {
  const paletteFiles = [
    {
      source: 'omarchy' as const,
      filePath: path.join(homeDir, '.config', 'omarchy', 'current', 'theme', 'colors.toml'),
      parse: parseOmarchyPalette,
    },
    {
      source: 'pywal' as const,
      filePath: path.join(cacheDir, 'wal', 'colors.json'),
      parse: parsePywalPalette,
    },
  ]

  for (const paletteFile of paletteFiles) {
    try {
      const palette = paletteFile.parse(await readFile(paletteFile.filePath, 'utf8'))
      if (palette) return { source: paletteFile.source, ...palette }
    } catch {
      // A missing or invalid optional palette must not prevent the native system fallback.
    }
  }

  return null
}
