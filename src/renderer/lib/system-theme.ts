import Color, { type ColorInstance } from 'color'
import type { SystemColorScheme, SystemTheme, SystemThemePalette } from '../../shared/constants/theme'

const LIGHT_FOREGROUND = 'oklch(0.99 0.005 110)'
const DARK_FOREGROUND = 'oklch(0.145 0 0)'

export function getSystemResolvedScheme(
  theme: SystemTheme | undefined,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (theme?.scheme === 'light') return 'light'
  if (theme?.scheme === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function colorToOklchCss(color: ColorInstance): string {
  const [l, c, h, a] = color.oklch().array()
  const lightness = formatNumber(l / 100)
  const chroma = formatNumber(c / 100)
  const hue = formatNumber(h)
  if (a !== undefined && a < 1) {
    return `oklch(${lightness} ${chroma} ${hue} / ${formatNumber(a)})`
  }
  return `oklch(${lightness} ${chroma} ${hue})`
}

function toColor(value: string | ColorInstance): ColorInstance {
  return typeof value === 'string' ? Color(value) : value
}

function toOklchCss(value: string | ColorInstance): string {
  return colorToOklchCss(toColor(value))
}

function contrastForeground(
  source: string | ColorInstance,
  palette: SystemThemePalette | null,
  baseScheme: 'light' | 'dark',
): string {
  const sourceColor = toColor(source)
  if (palette?.background && palette.foreground) {
    const bg = Color(palette.background)
    const fg = Color(palette.foreground)
    return toOklchCss(sourceColor.contrast(bg) > sourceColor.contrast(fg) ? bg : fg)
  }
  return baseScheme === 'dark' ? LIGHT_FOREGROUND : DARK_FOREGROUND
}

export function buildSystemThemeCssVariables(
  theme: SystemTheme,
  baseScheme: 'light' | 'dark',
): Record<string, string> {
  const accentHex = theme.accent ?? theme.palette?.accent
  const accent = accentHex ? Color(accentHex) : null
  const palette = theme.palette
  const hasPalette = palette?.background && palette?.foreground

  const variables: Record<string, string> = {}

  if (hasPalette && palette) {
    const bg = Color(palette.background)
    const fg = Color(palette.foreground)
    const primary = accent ?? fg
    const primaryForeground = contrastForeground(primary, palette, baseScheme)
    const accentColor = accent ?? primary
    const accentForeground = contrastForeground(accentColor, palette, baseScheme)
    const destructive = palette.colors?.color1 ? Color(palette.colors.color1) : Color('oklch(0.577 0.245 27.325)')
    const success = palette.colors?.color2 ? Color(palette.colors.color2) : Color('oklch(0.7 0.2 145)')
    const warning = palette.colors?.color3 ? Color(palette.colors.color3) : Color('oklch(0.75 0.18 75)')

    variables['--background'] = toOklchCss(bg)
    variables['--foreground'] = toOklchCss(fg)
    variables['--card'] = toOklchCss(bg.mix(fg, 0.05))
    variables['--card-foreground'] = toOklchCss(fg)
    variables['--popover'] = toOklchCss(bg.mix(fg, 0.03))
    variables['--popover-foreground'] = toOklchCss(fg)
    variables['--primary'] = toOklchCss(primary)
    variables['--primary-foreground'] = primaryForeground
    variables['--secondary'] = toOklchCss(bg.mix(fg, 0.1))
    variables['--secondary-foreground'] = toOklchCss(fg)
    variables['--muted'] = toOklchCss(bg.mix(fg, 0.08))
    variables['--muted-foreground'] = toOklchCss(fg.alpha(0.6))
    variables['--accent'] = toOklchCss(accentColor)
    variables['--accent-foreground'] = accentForeground
    variables['--destructive'] = toOklchCss(destructive)
    variables['--destructive-foreground'] = contrastForeground(destructive, palette, baseScheme)
    variables['--border'] = toOklchCss(fg.alpha(0.1))
    variables['--input'] = toOklchCss(fg.alpha(0.15))
    variables['--ring'] = toOklchCss(accentColor)
    variables['--sidebar-foreground'] = toOklchCss(fg)
    variables['--sidebar-primary'] = toOklchCss(accentColor)
    variables['--sidebar-primary-foreground'] = accentForeground
    variables['--sidebar-accent'] = toOklchCss(accentColor.alpha(0.15))
    variables['--sidebar-accent-foreground'] = accentForeground
    variables['--sidebar-border'] = toOklchCss(fg.alpha(0.1))
    variables['--sidebar-ring'] = toOklchCss(accentColor)
    variables['--success'] = toOklchCss(success)
    variables['--success-foreground'] = contrastForeground(success, palette, baseScheme)
    variables['--warning'] = toOklchCss(warning)
    variables['--warning-foreground'] = contrastForeground(warning, palette, baseScheme)
  } else if (accent) {
    const accentForeground = contrastForeground(accent, null, baseScheme)
    const accentCss = toOklchCss(accent)

    variables['--accent'] = accentCss
    variables['--primary'] = accentCss
    variables['--primary-foreground'] = accentForeground
    variables['--ring'] = accentCss
    variables['--sidebar-primary'] = accentCss
    variables['--sidebar-primary-foreground'] = accentForeground
    variables['--sidebar-accent'] = toOklchCss(accent.alpha(0.15))
    variables['--sidebar-accent-foreground'] = accentForeground
    variables['--sidebar-ring'] = accentCss
  }

  return variables
}

export function applySystemThemeStyle(
  variables: Record<string, string>,
): void {
  const id = 'system-theme-overrides'
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }

  const declarations = Object.entries(variables)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')

  style.textContent = `html.system { ${declarations} }`
}

export function removeSystemThemeStyle(): void {
  const style = document.getElementById('system-theme-overrides')
  style?.remove()
}
