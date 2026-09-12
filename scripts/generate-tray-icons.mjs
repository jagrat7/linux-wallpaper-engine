// Generates the PNG icons used by the tray context menu.
// Electron menu icons can't be SVG (dbusmenu sends PNG data), so we build
// lucide SVGs from their __iconNode data and rasterize them with rsvg-convert.
//
// Usage: node scripts/generate-tray-icons.mjs

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __iconNode as appWindowNode } from '../node_modules/lucide-react/dist/esm/icons/app-window.mjs'
import { __iconNode as pauseNode } from '../node_modules/lucide-react/dist/esm/icons/pause.mjs'
import { __iconNode as playNode } from '../node_modules/lucide-react/dist/esm/icons/play.mjs'
import { __iconNode as shuffleNode } from '../node_modules/lucide-react/dist/esm/icons/shuffle.mjs'
import { __iconNode as squareNode } from '../node_modules/lucide-react/dist/esm/icons/square.mjs'
import { __iconNode as powerNode } from '../node_modules/lucide-react/dist/esm/icons/power.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RSVG_CONVERT = '/usr/bin/rsvg-convert'

// The folder names mean "variant for the dark/light system theme" —
// dark gets light strokes, light gets dark strokes.
const VARIANTS = [
  { dir: 'dark', stroke: '#e5e5e5' },
  { dir: 'light', stroke: '#3f3f46' },
]

const ICONS = [
  { name: 'toggle-app', node: appWindowNode },
  { name: 'pause', node: pauseNode },
  { name: 'play', node: playNode },
  { name: 'shuffle', node: shuffleNode },
  { name: 'stop', node: squareNode },
  { name: 'quit', node: powerNode },
]

const SIZES = [
  { size: 16, suffix: '' },
  { size: 32, suffix: '@2x' },
]

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const buildSvg = (iconNode, stroke) => {
  const elements = iconNode
    .map(([tag, attrs]) => {
      const attrString = Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
        .join('')
      return `<${tag}${attrString}/>`
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${elements}</svg>`
  )
}

for (const { dir, stroke } of VARIANTS) {
  const outDir = path.join(repoRoot, 'assets', 'tray', dir)
  mkdirSync(outDir, { recursive: true })

  for (const { name, node } of ICONS) {
    const svg = buildSvg(node, stroke)
    for (const { size, suffix } of SIZES) {
      const outPath = path.join(outDir, `${name}${suffix}.png`)
      execFileSync(RSVG_CONVERT, ['-w', String(size), '-h', String(size), '-o', outPath], {
        input: svg,
      })
      console.log(`wrote ${path.relative(repoRoot, outPath)}`)
    }
  }
}
