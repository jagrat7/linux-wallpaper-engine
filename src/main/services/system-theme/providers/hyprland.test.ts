import { describe, expect, it } from 'vitest'
import {
  getHyprlandWatchPaths,
  getPywalThemePaths,
  getVanillaHyprlandPaths,
  parseHyprlandTheme,
  parseKeyValueTheme,
} from './hyprland'

describe('hyprland theme paths', () => {
  it('watches pywal then vanilla Hyprland config files', () => {
    expect(getPywalThemePaths('/home/user')).toEqual([
      '/home/user/.cache/wal/colors.sh',
    ])
    expect(getVanillaHyprlandPaths('/home/user')).toEqual([
      '/home/user/.config/hypr/hyprland.conf',
      '/home/user/.config/hypr/colors.conf',
    ])
    expect(getHyprlandWatchPaths('/home/user')).toEqual([
      '/home/user/.cache/wal/colors.sh',
      '/home/user/.config/hypr/hyprland.conf',
      '/home/user/.config/hypr/colors.conf',
    ])
  })
})

describe('parseKeyValueTheme', () => {
  it('parses a pywal colors.sh palette', () => {
    const theme = parseKeyValueTheme(`
wallpaper='/home/user/pic.png'
foreground='#cdd6f4'
background='#1e1e2e'
cursor='#cdd6f4'
color0='#313244'
color1='#f38ba8'
color2='#a6e3a1'
color3='#f9e2af'
color4='#89b4fa'
color7='#bac2de'
color8='#585b70'
color15='#cdd6f4'
`)

    expect(theme).toEqual(expect.objectContaining({
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      card: '#313244',
      primary: '#89b4fa',
      mutedForeground: '#bac2de',
      destructive: '#f38ba8',
      success: '#a6e3a1',
      warning: '#f9e2af',
    }))
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

    expect(theme).toEqual(expect.objectContaining({
      background: '#302270',
      foreground: '#86f3f5',
      card: '#3a2b80',
      primary: '#898efa',
      accent: '#4c39a0',
      border: '#9368bf',
      sidebarPrimary: 'color-mix(in oklch, #898efa 22%, #302270)',
      sidebarAccent: '#4c39a0',
    }))
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

    expect(theme).toEqual(expect.objectContaining({
      primary: '#8a8588',
      primaryForeground: '#000000',
      accent: '#584e51',
      border: '#584e51',
      sidebarPrimary: 'color-mix(in oklch, #8a8588 22%, var(--sidebar))',
      sidebarAccent: '#584e51',
    }))
  })

  it('parses vanilla hyprland.conf border colors', () => {
    const theme = parseHyprlandTheme(`
general {
    col.active_border = rgba(33ccffee) rgba(00ff99ee) 45deg
    col.inactive_border = rgba(595959aa)
}
`)

    expect(theme).toEqual(expect.objectContaining({
      primary: '#33ccff',
      primaryForeground: '#000000',
      accent: '#595959',
      border: '#595959',
      sidebarPrimary: 'color-mix(in oklch, #33ccff 22%, var(--sidebar))',
      sidebarAccent: '#595959',
    }))
  })

  it('rejects Lua without usable colors', () => {
    expect(parseHyprlandTheme('hl.config({ decoration = { rounding = 8 } })')).toBeNull()
  })
})
