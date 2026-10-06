import type { DesktopThemeProvider } from '../system-theme.types'
import { cosmicThemeProvider } from './cosmic'
import { hyprlandThemeProvider } from './hyprland'
import { kdeThemeProvider } from './kde'

export const desktopThemeProviders = [
  cosmicThemeProvider,
  kdeThemeProvider,
  hyprlandThemeProvider,
] satisfies DesktopThemeProvider[]
