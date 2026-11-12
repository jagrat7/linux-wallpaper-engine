// Writes what the shadcn CLI says about this project's setup, for the design page: the choices
// shadcn/create offers, and the preset code that stands for them. Run it after changing
// components.json or the theme:
//
//   bun scripts/design-preset.ts
//
// Set the two paths below for the project, and its package runner if it isn't bun.

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
/** The folder components.json is in, and the file to write, both from the repo root. */
const SHADCN_DIR = '.'
const OUT = 'src/renderer/design/shadcn-preset.gen.json'

const info = JSON.parse(
  execSync('bun x shadcn@latest info --json', { cwd: join(root, SHADCN_DIR), encoding: 'utf8' }),
)

writeFileSync(
  join(root, OUT),
  `${JSON.stringify(
    {
      // The component library: base (Base UI), radix or aria.
      base: info.config?.base,
      code: info.preset?.code,
      values: info.preset?.values,
      // Choices this project makes that shadcn/create has no option for (its own theme, fonts
      // or radius). For these, `values` holds the preset's stand-in, not what the project uses.
      fallbacks: info.preset?.fallbacks,
    },
    null,
    2,
  )}\n`,
)
console.log(`Wrote ${OUT}: --preset ${info.preset?.code ?? '(none)'}`)
