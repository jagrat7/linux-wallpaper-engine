import { homedir } from 'node:os'
import path from 'node:path'
import type { DesktopThemeProvider, SystemThemePalette } from '../system-theme.types'
import {
  hyprlandThemeProvider,
  parseHyprlandTheme,
  parseKeyValueTheme,
  readFirstPalette,
} from './hyprland'

export const parseOmarchyTheme = parseKeyValueTheme

export const getOmarchyThemePaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/colors.toml'),
  // Omarchy used this location before moving runtime state out of ~/.config.
  path.join(homeDirectory, '.config/omarchy/current/theme/colors.toml'),
]

export const getOmarchyHyprlandPaths = (homeDirectory: string): string[] => [
  path.join(homeDirectory, '.local/state/omarchy/current/theme/hyprland.lua'),
  path.join(homeDirectory, '.config/omarchy/current/theme/hyprland.lua'),
]

export const getOmarchyWatchPaths = (homeDirectory: string): string[] => [
  ...getOmarchyThemePaths(homeDirectory),
  ...getOmarchyHyprlandPaths(homeDirectory),
  // Theme switches replace the entire current/theme directory, then update this
  // marker in its stable parent directory.
  path.join(homeDirectory, '.local/state/omarchy/current/theme.name'),
]

const OMARCHY_THEME_PATHS = getOmarchyThemePaths(homedir())
const OMARCHY_HYPRLAND_PATHS = getOmarchyHyprlandPaths(homedir())
const OMARCHY_WATCH_PATHS = getOmarchyWatchPaths(homedir())

const readOmarchyPalette = (): SystemThemePalette | null =>
  readFirstPalette(OMARCHY_THEME_PATHS, parseOmarchyTheme)
  ?? readFirstPalette(OMARCHY_HYPRLAND_PATHS, parseHyprlandTheme)
  ?? hyprlandThemeProvider.readPalette()

export const omarchyThemeProvider = {
  matches: (desktop: string) => desktop.includes('omarchy') || desktop.includes('hyprland'),
  watchPaths: [...OMARCHY_WATCH_PATHS, ...hyprlandThemeProvider.watchPaths],
  readPalette: readOmarchyPalette,
} satisfies DesktopThemeProvider
