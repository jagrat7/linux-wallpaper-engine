import type { DesktopThemeProvider } from '../system-theme.types'
import { cosmicThemeProvider } from './cosmic'
import { hyprlandThemeProvider } from './hyprland'
import { kdeThemeProvider } from './kde'
import { omarchyThemeProvider } from './omarchy'

export const desktopThemeProviders = [
  cosmicThemeProvider,
  kdeThemeProvider,
  omarchyThemeProvider,
  hyprlandThemeProvider,
] satisfies DesktopThemeProvider[]
