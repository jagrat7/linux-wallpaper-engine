import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { getHyprlandWatchPaths, parseHyprlandTheme, readHyprlangConfig } from './hyprland'

describe('getHyprlandWatchPaths', () => {
  it('watches the Lua and hyprlang configs', () => {
    expect(getHyprlandWatchPaths('/home/user')).toEqual([
      '/home/user/.config/hypr/hyprland.lua',
      '/home/user/.config/hypr/hyprland.conf',
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

  it('resolves chained hyprlang variables', () => {
    const theme = parseHyprlandTheme(`
$red = rgb(ff0000)
$border = $red
general {
    col.active_border = $border
}
`)

    expect(theme).toEqual(expect.objectContaining({ primary: '#ff0000' }))
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

describe('readHyprlangConfig', () => {
  it('inlines and watches sourced files, skipping files the config does not source', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'hypr-'))
    const directory = path.join(home, '.config/hypr')
    mkdirSync(directory, { recursive: true })
    try {
      writeFileSync(
        path.join(directory, 'hyprland.conf'),
        'source = ./theme.conf\nsource = ./generated.conf\n',
      )
      writeFileSync(path.join(directory, 'theme.conf'), '$accent = rgb(89b4fa)\n')
      writeFileSync(path.join(directory, 'colors.conf'), '$accent = rgb(ff0000)\n')

      expect(parseHyprlandTheme(readHyprlangConfig(path.join(directory, 'hyprland.conf')))).toEqual(
        expect.objectContaining({ primary: '#89b4fa' }),
      )
      expect(getHyprlandWatchPaths(home)).toEqual([
        path.join(directory, 'hyprland.lua'),
        path.join(directory, 'hyprland.conf'),
        path.join(directory, 'theme.conf'),
        path.join(directory, 'generated.conf'),
      ])
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
