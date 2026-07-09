import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_OPTIONS, type ThemeOption } from '../../shared/constants/theme'
import { trpc } from '../lib/trpc'

const SYSTEM_THEME_PROPERTIES = {
  accent: '--system-accent',
  background: '--system-background',
  foreground: '--system-foreground',
  selection_background: '--system-selection-background',
  selection_foreground: '--system-selection-foreground',
  color0: '--system-color-0',
  color1: '--system-color-1',
  color2: '--system-color-2',
  color3: '--system-color-3',
  color7: '--system-color-7',
  color8: '--system-color-8',
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
  const { data: systemPalette } = trpc.settings.systemTheme.useQuery(undefined, {
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
      const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
      root.classList.add('system')
      root.classList.toggle('dark', colorScheme.matches)

      Object.entries(systemPalette ?? {}).forEach(([key, value]) => {
        const property = SYSTEM_THEME_PROPERTIES[key as keyof typeof SYSTEM_THEME_PROPERTIES]
        if (property !== undefined) root.style.setProperty(property, value)
      })

      const syncColorScheme = (event: MediaQueryListEvent) => {
        root.classList.toggle('dark', event.matches)
      }
      colorScheme.addEventListener('change', syncColorScheme)
      return () => colorScheme.removeEventListener('change', syncColorScheme)
    }

    // Apply selected theme
    root.classList.add(mode)
  }, [mode, systemPalette])

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
