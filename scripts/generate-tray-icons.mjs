// Generates the PNG icons used by the tray context menu.
// Electron menu icons can't be SVG (dbusmenu sends PNG data), so we render
// lucide icons to SVG markup and rasterize them with rsvg-convert (librsvg).
//
// Usage: bun run icons:tray

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppWindow, Pause, Play, Power, Shuffle, Square } from 'lucide-react'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The folder names mean "variant for the dark/light system theme" —
// dark gets light strokes, light gets dark strokes.
const VARIANTS = [
  { dir: 'dark', stroke: '#e5e5e5' },
  { dir: 'light', stroke: '#3f3f46' },
]

const ICONS = [
  { name: 'toggle-app', Icon: AppWindow },
  { name: 'pause', Icon: Pause },
  { name: 'play', Icon: Play },
  { name: 'shuffle', Icon: Shuffle },
  { name: 'stop', Icon: Square },
  { name: 'quit', Icon: Power },
]

const SIZES = [
  { size: 16, suffix: '' },
  { size: 32, suffix: '@2x' },
]

for (const { dir, stroke } of VARIANTS) {
  const outDir = path.join(repoRoot, 'assets', 'tray', dir)
  mkdirSync(outDir, { recursive: true })

  for (const { name, Icon } of ICONS) {
    const svg = renderToStaticMarkup(createElement(Icon, { color: stroke }))
    for (const { size, suffix } of SIZES) {
      const outPath = path.join(outDir, `${name}${suffix}.png`)
      execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', outPath], {
        input: svg,
      })
      console.log(`wrote ${path.relative(repoRoot, outPath)}`)
    }
  }
}
