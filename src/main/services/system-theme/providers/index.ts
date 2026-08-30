import type { ThemeProvider } from '../system-theme.types'
import { cosmicThemeProvider } from './cosmic'
import { kdeThemeProvider } from './kde'
import { omarchyThemeProvider } from './omarchy'

export const desktopThemeProviders = [
  cosmicThemeProvider,
  kdeThemeProvider,
  omarchyThemeProvider,
].toSorted((left, right) => right.priority - left.priority) satisfies ThemeProvider[]
