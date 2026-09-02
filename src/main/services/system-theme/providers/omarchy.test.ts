import { describe, expect, it } from 'vitest'
import {
  getOmarchyHyprlandPaths,
  getOmarchyThemePaths,
  getOmarchyWatchPaths,
  parseOmarchyTheme,
} from './omarchy'

describe('getOmarchyThemePaths', () => {
  it('uses Omarchy theme files and the Hyprland child for everything else', () => {
    expect(getOmarchyThemePaths('/home/user')).toEqual([
      '/home/user/.local/state/omarchy/current/theme/colors.toml',
      '/home/user/.config/omarchy/current/theme/colors.toml',
    ])
    expect(getOmarchyHyprlandPaths('/home/user')).toEqual([
      '/home/user/.local/state/omarchy/current/theme/hyprland.lua',
      '/home/user/.config/omarchy/current/theme/hyprland.lua',
    ])
    expect(getOmarchyWatchPaths('/home/user')).toEqual([
      '/home/user/.local/state/omarchy/current/theme/colors.toml',
      '/home/user/.config/omarchy/current/theme/colors.toml',
      '/home/user/.local/state/omarchy/current/theme/hyprland.lua',
      '/home/user/.config/omarchy/current/theme/hyprland.lua',
      '/home/user/.local/state/omarchy/current/theme.name',
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

    expect(theme).toEqual(expect.objectContaining({
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
    }))
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

    expect(theme).toEqual(expect.objectContaining({
      card: '#313244',
      accent: '#45475a',
      mutedForeground: '#bac2de',
      destructive: '#f38ba8',
      success: '#a6e3a1',
      warning: '#f9e2af',
    }))
  })

  it('rejects an incomplete palette', () => {
    expect(parseOmarchyTheme('accent = "#89b4fa"')).toBeNull()
  })
})
