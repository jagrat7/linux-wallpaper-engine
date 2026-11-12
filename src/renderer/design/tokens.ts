// The design page's tokens, read from where they are defined so the page can't drift: colours,
// fonts, radius and the rest from the stylesheet, type roles and scales from DESIGN.md's front
// matter if the project has one.

import type { CSSProperties } from 'react'

export type Theme = 'light' | 'dark'

export type TypeRole = {
  name: string
  /** The Tailwind classes that set it. */
  classes: string
  /** The same as styles, when the classes were worked out (from DESIGN.md) rather than typed,
      so Tailwind has made no CSS for them. */
  style?: CSSProperties
}

export type Tokens = ReturnType<typeof readTokens>

type Declarations = Record<string, string>

/** The stylesheet's top-level blocks, and those inside `@layer`: what opens each, and its body. */
function blocks(css: string): { opener: string; body: string }[] {
  const out: { opener: string; body: string }[] = []
  let depth = 0
  let start = 0
  let open = 0
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') {
      if (depth === 0) open = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth !== 0) continue
      const opener = css.slice(start, open).replace(/\s+/g, ' ').trim()
      const body = css.slice(open + 1, i)
      if (opener.startsWith('@layer')) out.push(...blocks(body))
      else out.push({ opener, body })
      start = i + 1
    } else if (ch === ';' && depth === 0) start = i + 1
  }
  return out
}

function declarations(body: string): Declarations {
  const out: Declarations = {}
  for (const [, name = '', declared = ''] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[name] = declared.replace(/\s+/g, ' ').trim()
  }
  return out
}

const LIGHT = /^(:root|html|:host)$/
const DARK = /^(:root|html)?(\.dark|\[[\w-]+=["']?dark["']?\])$/
const COLOUR =
  /^(#|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\()|^(transparent|currentcolor|white|black)$/i
const SHADCN =
  /^(background|foreground|border|input|ring|(card|popover|primary|secondary|muted|accent|destructive)(-foreground)?)$/

/** `ownName` is what to call the tokens that are the project's own, not shadcn's. */
export function readTokens(css: string, designMd = '', ownName = 'Project') {
  // `light` and `dark` are the theme's variables. `inline` is `@theme inline`, which names
  // them for Tailwind, and `own` is any other `@theme` block: the project's own tokens.
  const light: Declarations = {}
  const dark: Declarations = {}
  const inline: Declarations = {}
  const own: Declarations = {}
  for (const { opener, body } of blocks(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const selectors = opener.split(',').map((s) => s.trim())
    if (opener.startsWith('@theme')) {
      Object.assign(/^@theme\s+inline/.test(opener) ? inline : own, declarations(body))
      continue
    }
    if (selectors.some((s) => LIGHT.test(s))) Object.assign(light, declarations(body))
    if (selectors.some((s) => DARK.test(s))) Object.assign(dark, declarations(body))
  }

  /** The themes the stylesheet has. */
  const themes: Theme[] = Object.keys(dark).length > 0 ? ['light', 'dark'] : ['light']

  /** A token's value in a theme, as the stylesheet declares it. */
  const value = (theme: Theme, name: string): string =>
    (theme === 'dark' ? dark[name] : undefined) ?? light[name] ?? own[name] ?? inline[name] ?? ''

  /** The same, with a `var(--other)` followed to the colour it names. The page shows both
      themes' values at once, so it can't leave that to the browser. */
  const colour = (theme: Theme, name: string, depth = 0): string => {
    const declared = value(theme, name)
    const [, alias] = declared.match(/^var\(--([\w-]+)\)$/) ?? []
    return alias && depth < 8 ? colour(theme, alias, depth + 1) : declared
  }

  const colours = [
    ...Object.keys(light),
    ...Object.keys(own).filter((n) => n.startsWith('color-')),
    // A colour `@theme inline` sets itself, rather than naming a variable.
    ...Object.keys(inline).filter((n) => n.startsWith('color-') && !inline[n]?.startsWith('var(')),
  ].filter((n, i, all) => all.indexOf(n) === i && COLOUR.test(colour('light', n)))

  /** Every colour token, grouped. */
  const groups = [
    { name: 'shadcn', tokens: colours.filter((n) => SHADCN.test(n)) },
    {
      name: ownName,
      tokens: colours.filter((n) => !/^(chart|sidebar)/.test(n) && !SHADCN.test(n)),
    },
    { name: 'Chart', tokens: colours.filter((n) => n.startsWith('chart')) },
    { name: 'Sidebar', tokens: colours.filter((n) => n.startsWith('sidebar')) },
  ].filter((group) => group.tokens.length > 0)

  /** The face a font token names first: "Inter" for `font-sans`. Empty if there is no such token. */
  const fontFace = (token: string): string =>
    (inline[token] ?? own[token] ?? light[token] ?? '')
      .replace(/,[\s\S]*$/, '')
      .replace(/^var\(--(font-)?|\)$|["']/g, '')
      .replace(/ Variable$/, '')
      .trim()

  /** The radius steps the stylesheet names for Tailwind: `radius-sm`, `radius-md`… */
  const radiusSteps = Object.keys(inline).filter((n) => n.startsWith('radius-'))

  // ---------- DESIGN.md ----------

  const frontMatter = (designMd.split('---')[1] ?? '').split('\n')

  /** The lines under a top-level key of the front matter. */
  const under = (key: string): string[] => {
    const at = frontMatter.findIndex((l) => l.startsWith(`${key}:`))
    if (at < 0) return []
    const rest = frontMatter.slice(at + 1)
    const end = rest.findIndex((l) => /^\S/.test(l))
    return end < 0 ? rest : rest.slice(0, end)
  }

  /** A flat scale in the front matter: `spacing:` or `rounded:`. */
  const scale = (key: 'spacing' | 'rounded'): { name: string; px: number }[] =>
    under(key).flatMap((line) => {
      const [, name, px] = line.match(/^ {2}(\S+):\s*(\d+)px/) ?? []
      return name ? [{ name, px: Number(px) }] : []
    })

  const radiusPx = Number.parseFloat(light.radius ?? '0') * (light.radius?.endsWith('rem') ? 16 : 1)

  /** The Tailwind class that gives a corner of this size: a step of the stylesheet's scale if
      one is that size, else an arbitrary value. */
  const radiusClass = (px: number): string => {
    if (px >= 999) return 'rounded-full'
    const step = radiusSteps.find((name) => {
      const declared = inline[name] ?? ''
      const [, sign, by] = declared.match(/var\(--radius\)\s*([+-])\s*([\d.]+)px/) ?? []
      const [, times] = declared.match(/var\(--radius\)\s*\*\s*([\d.]+)/) ?? []
      const size = sign && by ? radiusPx + Number(sign + by) : radiusPx * Number(times ?? 1)
      return declared.includes('var(--radius)') && size === px
    })
    return step ? step.replace('radius', 'rounded') : `rounded-[${px}px]`
  }

  const roles: Record<string, string>[] = []
  for (const line of under('typography')) {
    const [, role] = line.match(/^ {2}(\S+):\s*$/) ?? []
    const [, prop, declared = ''] = line.match(/^ {4}(\S+):\s*(.+)$/) ?? []
    const last = roles.at(-1)
    if (role) roles.push({ name: role })
    else if (prop && last) last[prop] = declared.replace(/^"|"$/g, '')
  }

  const WEIGHT: Record<string, string> = { '400': '', '500': 'font-medium', '700': 'font-bold' }
  const typeRole = (role: Record<string, string>, name: string): TypeRole => ({
    name,
    classes: [
      role.fontFamily?.includes('Mono') ? 'font-mono' : '',
      role.fontSize && `text-[${role.fontSize}]`,
      role.lineHeight && `leading-[${role.lineHeight}]`,
      WEIGHT[role.fontWeight ?? '400'] ?? `font-[${role.fontWeight}]`,
      role.letterSpacing && `tracking-[${role.letterSpacing}]`,
    ]
      .filter(Boolean)
      .join(' '),
    style: {
      fontSize: role.fontSize,
      fontWeight: role.fontWeight,
      lineHeight: role.lineHeight,
      letterSpacing: role.letterSpacing,
    },
  })

  /** The `typography:` roles in DESIGN.md's front matter. A role's `-dark` twin replaces it in
      dark. */
  const typography = (theme: Theme): TypeRole[] =>
    roles
      .filter((r) => !r.name?.endsWith('-dark'))
      .map((r) => {
        const night = roles.find((other) => other.name === `${r.name}-dark`)
        return typeRole(theme === 'dark' && night ? night : r, r.name ?? '')
      })

  // ---------- Both themes on one page ----------
  //
  // The stylesheet's dark theme hangs off <html>, so nothing inside a dark page can be light.
  // This page shows a light panel and a dark one side by side whichever theme it is in, so it
  // themes itself another way: <html> keeps no theme of the site's, the page's own theme is
  // these variables on <html data-design-theme>, and each panel (`.design-light`,
  // `.design-dark`) sets its theme's variables again, whatever is around it.

  const variables = (values: Declarations) =>
    Object.entries(values)
      .map(([name, declared]) => `--${name}:${declared};`)
      .join('')

  // The `--color-*` aliases resolve where they are declared, on <html>. Each scope restates them.
  const aliases = variables(
    Object.fromEntries(Object.entries(inline).filter(([name]) => name.startsWith('color-'))),
  )
  // The project's own tokens that dark changes, at their light values. Not the ones the theme
  // sets itself (those are in `light`), nor one that only names itself (`--x: var(--x)`).
  const ownByDay = Object.fromEntries(
    Object.keys(dark)
      .filter((name) => !(name in light) && (name in own || name in inline))
      .map((name) => [name, own[name] ?? inline[name] ?? ''])
      .filter(([name, declared]) => !declared?.includes(`var(--${name})`)),
  )

  const themeCss = [
    `html[data-design-theme="light"],.design-light{${variables({ ...light, ...ownByDay })}${aliases}color-scheme:light}`,
    `html[data-design-theme="dark"],.design-dark{${variables(dark)}${aliases}color-scheme:dark}`,
  ].join('\n')

  return {
    themes,
    value,
    colour,
    groups,
    /** The corner the stylesheet sets, `--radius`. */
    radius: light.radius ?? '',
    radiusSteps,
    radiusClass,
    fontFace,
    scale,
    typography,
    themeCss,
  }
}
