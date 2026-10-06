import { describe, expect, it } from 'vite-plus/test'
import { getHyprlandConfigPaths, parseHyprlandTheme } from './hyprland'

describe('getHyprlandConfigPaths', () => {
  it('reads the Lua and hyprlang configs plus a sourced colors file', () => {
    expect(getHyprlandConfigPaths('/home/user')).toEqual([
      '/home/user/.config/hypr/hyprland.lua',
      '/home/user/.config/hypr/hyprland.conf',
      '/home/user/.config/hypr/colors.conf',
    ])
  })
})

describe('parseHyprlandTheme', () => {
  it('uses a semantic Lua color table when one is available', () => {
    const theme = parseHyprlandTheme(`
local colors = {
  background = "302270",
  surface = "3a2b80",
  surface_alt = "4c39a0",
  border = "9368bf",
  accent = "898efa",
  foreground = "86f3f5",
}
`)

    expect(theme).toEqual(
      expect.objectContaining({
        background: '#302270',
        foreground: '#86f3f5',
        card: '#3a2b80',
        primary: '#898efa',
        accent: '#4c39a0',
        border: '#9368bf',
        sidebarPrimary: 'color-mix(in oklch, #898efa 22%, #302270)',
        sidebarAccent: '#4c39a0',
      }),
    )
  })

  it('falls back to Lua border colors and gradients', () => {
    const theme = parseHyprlandTheme(`
local active_border_color = { colors = { "rgba(8a8588ee)", "rgba(e2dddcee)" }, angle = 45 }
local inactive_border_color = "rgba(584e51aa)"

hl.config({
  general = { col = {
    active_border = active_border_color,
    inactive_border = inactive_border_color,
  } },
})
`)

    expect(theme).toEqual(
      expect.objectContaining({
        primary: '#8a8588',
        primaryForeground: '#000000',
        accent: '#584e51',
        border: '#584e51',
        sidebarPrimary: 'color-mix(in oklch, #8a8588 22%, var(--sidebar))',
        sidebarAccent: '#584e51',
      }),
    )
  })

  it('parses hyprland.conf border colors', () => {
    const theme = parseHyprlandTheme(`
general {
    col.active_border = rgba(33ccffee) rgba(00ff99ee) 45deg
    col.inactive_border = rgba(595959aa)
}
`)

    expect(theme).toEqual(
      expect.objectContaining({
        primary: '#33ccff',
        primaryForeground: '#000000',
        border: '#595959',
        sidebarPrimary: 'color-mix(in oklch, #33ccff 22%, var(--sidebar))',
      }),
    )
  })

  it('resolves hyprlang variables and ignores commented-out lines', () => {
    const theme = parseHyprlandTheme(`
$blue = rgb(89b4fa)
general {
    # col.active_border = rgba(ff0000ee)
    col.active_border = $blue
    col.inactive_border = rgba(595959aa)
}
`)

    expect(theme).toEqual(expect.objectContaining({ primary: '#89b4fa', border: '#595959' }))
  })

  it('does not borrow a nearby color for an undefined variable', () => {
    const theme = parseHyprlandTheme(`
general {
    col.active_border = $missing
    col.inactive_border = rgba(595959aa)
}
`)

    expect(theme).toEqual(expect.objectContaining({ primary: undefined, border: '#595959' }))
  })

  it('reads a semantic palette from hyprlang colour variables', () => {
    const theme = parseHyprlandTheme(`
$background = rgb(1e1e2e)
$foreground = rgb(cdd6f4)
$accent = rgb(89b4fa)
$muted = rgb(585b70)
`)

    expect(theme).toEqual(
      expect.objectContaining({
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        primary: '#89b4fa',
        border: '#585b70',
      }),
    )
  })

  it('rejects Lua without usable colors', () => {
    expect(parseHyprlandTheme('hl.config({ decoration = { rounding = 8 } })')).toBeNull()
  })
})
