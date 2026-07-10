import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_OPTIONS, type ThemeOption } from '../../shared/constants/theme'
import { trpc } from '../lib/trpc'

const SYSTEM_THEME_PROPERTIES = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  border: '--border',
  input: '--input',
  success: '--success',
  warning: '--warning',
  ring: '--ring',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarRing: '--sidebar-ring',
} as const

// Derive type from constants - single source of truth
type ThemeMode = ThemeOption

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: ThemeMode
  storageKey?: string
}

type ThemeProviderState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const initialState: ThemeProviderState = {
  mode: 'system',
  setMode: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultMode = 'system',
  storageKey = 'wallpaper-engine-theme',
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(storageKey) as ThemeMode) ?? defaultMode
  )
  const { data: systemTheme } = trpc.settings.systemTheme.useQuery(undefined, {
    enabled: mode === 'system',
  })

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    THEME_OPTIONS.forEach((option) => {
      root.classList.remove(option.value)
    })

    Object.values(SYSTEM_THEME_PROPERTIES).forEach((property) => {
      root.style.removeProperty(property)
    })

    // Handle system theme
    if (mode === 'system') {
      const isDark = systemTheme?.scheme !== 'light'
      root.classList.add('system', isDark ? 'dark' : 'light')

      Object.entries(systemTheme?.palette ?? {}).forEach(([key, value]) => {
        const property = SYSTEM_THEME_PROPERTIES[key as keyof typeof SYSTEM_THEME_PROPERTIES]
        if (property !== undefined) root.style.setProperty(property, value)
      })

      return
    }

    // Apply selected theme
    root.classList.add(mode)
  }, [mode, systemTheme])

  const value = {
    mode,
    setMode: (newMode: ThemeMode) => {
      localStorage.setItem(storageKey, newMode)
      setMode(newMode)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
