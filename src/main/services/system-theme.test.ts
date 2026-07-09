import { describe, expect, it } from 'vitest'
import { getSystemThemePalette } from './system-theme'

const omarchyColors = `
accent = "#89b4fa"
foreground = "#cdd6f4"
background = "#1e1e2e"
`

const pywalColors = JSON.stringify({
  special: { background: '#101010', foreground: '#f0f0f0' },
  colors: { color4: '#abcdef' },
})

describe('getSystemThemePalette', () => {
  it('prefers the active Omarchy theme palette', async () => {
    const readFile = async (filePath: string): Promise<string> => {
      if (filePath.endsWith('colors.toml')) return omarchyColors
      throw new Error('not found')
    }

    await expect(getSystemThemePalette({ homeDir: '/home/test', readFile })).resolves.toEqual({
      source: 'omarchy',
      accent: '#89b4fa',
    })
  })

  it('falls back to a pywal-compatible palette', async () => {
    const readFile = async (filePath: string): Promise<string> => {
      if (filePath.endsWith('wal/colors.json')) return pywalColors
      throw new Error('not found')
    }

    await expect(getSystemThemePalette({ homeDir: '/home/test', readFile })).resolves.toEqual({
      source: 'pywal',
      accent: '#abcdef',
    })
  })

  it('returns null when no valid palette is available', async () => {
    await expect(getSystemThemePalette({
      homeDir: '/home/test',
      readFile: async () => 'not a palette',
    })).resolves.toBeNull()
  })
})
