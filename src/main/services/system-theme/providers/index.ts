import type { DesktopThemeProvider } from '../system-theme.types'
import { cosmicThemeProvider } from './cosmic'
import { kdeThemeProvider } from './kde'
import { omarchyThemeProvider } from './omarchy'

export const desktopThemeProviders = [
  cosmicThemeProvider,
  kdeThemeProvider,
  omarchyThemeProvider,
] satisfies DesktopThemeProvider[]
