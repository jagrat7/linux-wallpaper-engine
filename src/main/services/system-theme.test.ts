import { describe, expect, it } from 'vitest'
import {
  getOmarchyHyprlandPaths,
  getOmarchyThemePaths,
  parseOmarchyHyprlandTheme,
  parseOmarchyTheme,
} from './system-theme'

describe('getOmarchyThemePaths', () => {
  it('prefers current Omarchy state and falls back to its legacy config path', () => {
    expect(getOmarchyThemePaths('/home/user')).toEqual([
      '/home/user/.local/state/omarchy/current/theme/colors.toml',
      '/home/user/.config/omarchy/current/theme/colors.toml',
    ])
    expect(getOmarchyHyprlandPaths('/home/user')).toEqual([
      '/home/user/.local/state/omarchy/current/theme/hyprland.lua',
      '/home/user/.config/omarchy/current/theme/hyprland.lua',
    ])
  })
})

describe('parseOmarchyTheme', () => {
  it('parses the current Omarchy semantic palette', () => {
    const theme = parseOmarchyTheme(`
mode = "light"
accent = "#3264eb"
selection = "#d0d0d0"
muted = "#9e9e9e"
background = "#fafafa"
dark_background = "#ececec"
lighter_background = "#f5f5f5"
foreground = "#212121"
dark_foreground = "#757575"
bright_foreground = "#000000"
red = "#c900c4"
yellow = "#026fde"
green = "#4a2fd0"
`)

    expect(theme).toEqual({
      scheme: 'light',
      palette: expect.objectContaining({
        background: '#fafafa',
        foreground: '#212121',
        card: '#f5f5f5',
        primary: '#3264eb',
        primaryForeground: '#fafafa',
        accent: '#d0d0d0',
        mutedForeground: '#9e9e9e',
        sidebar: '#fafafa',
        sidebarForeground: '#212121',
        sidebarAccent: '#d0d0d0',
        sidebarAccentForeground: '#000000',
        sidebarBorder: '#9e9e9e',
        sidebarPrimary: 'color-mix(in oklch, #3264eb 22%, #fafafa)',
        sidebarPrimaryForeground: '#212121',
        destructive: '#c900c4',
        success: '#4a2fd0',
        warning: '#026fde',
      }),
    })
  })

  it('keeps compatibility with the legacy Omarchy ANSI palette', () => {
    const theme = parseOmarchyTheme(`
background = "#1e1e2e"
foreground = "#cdd6f4"
accent = "#89b4fa"
selection_background = "#45475a"
selection_foreground = "#cdd6f4"
color0 = "#313244"
color1 = "#f38ba8"
color2 = "#a6e3a1"
color3 = "#f9e2af"
color7 = "#bac2de"
color8 = "#585b70"
`)

    expect(theme).toEqual({
      scheme: 'dark',
      palette: expect.objectContaining({
        card: '#313244',
        accent: '#45475a',
        mutedForeground: '#bac2de',
        destructive: '#f38ba8',
        success: '#a6e3a1',
        warning: '#f9e2af',
      }),
    })
  })

  it('rejects an incomplete palette', () => {
    expect(parseOmarchyTheme('accent = "#89b4fa"')).toBeNull()
  })
})

describe('parseOmarchyHyprlandTheme', () => {
  it('uses a semantic Lua color table when one is available', () => {
    const theme = parseOmarchyHyprlandTheme(`
local colors = {
  background = "302270",
  surface = "3a2b80",
  surface_alt = "4c39a0",
  border = "9368bf",
  accent = "898efa",
  foreground = "86f3f5",
}
`)

    expect(theme).toEqual({
      scheme: 'dark',
      palette: expect.objectContaining({
        background: '#302270',
        foreground: '#86f3f5',
        card: '#3a2b80',
        primary: '#898efa',
        accent: '#4c39a0',
        border: '#9368bf',
        sidebarPrimary: 'color-mix(in oklch, #898efa 22%, #302270)',
        sidebarAccent: '#4c39a0',
      }),
    })
  })

  it('falls back to Lua border colors and gradients', () => {
    const theme = parseOmarchyHyprlandTheme(`
local active_border_color = { colors = { "rgba(8a8588ee)", "rgba(e2dddcee)" }, angle = 45 }
local inactive_border_color = "rgba(584e51aa)"

hl.config({
  general = { col = {
    active_border = active_border_color,
    inactive_border = inactive_border_color,
  } },
})
`)

    expect(theme).toEqual({
      scheme: null,
      palette: expect.objectContaining({
        primary: '#8a8588',
        primaryForeground: '#000000',
        accent: '#584e51',
        border: '#584e51',
        sidebarPrimary: 'color-mix(in oklch, #8a8588 22%, var(--sidebar))',
        sidebarAccent: '#584e51',
      }),
    })
  })

  it('rejects Lua without usable colors', () => {
    expect(parseOmarchyHyprlandTheme('hl.config({ decoration = { rounding = 8 } })')).toBeNull()
  })
})
