import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_OPTIONS, type ThemeOption } from '../../shared/constants/theme'
import { trpc } from '@/lib/trpc'

const SYSTEM_COLOR_PROPERTIES = [
  '--system-accent',
] as const

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
  const isSystemMode = mode === 'system'
  const { data: systemPalette } = trpc.systemTheme.get.useQuery(undefined, {
    enabled: isSystemMode,
    refetchInterval: isSystemMode ? 5000 : false,
  })

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    THEME_OPTIONS.forEach((option) => {
      root.classList.remove(option.value)
    })
    SYSTEM_COLOR_PROPERTIES.forEach((property) => root.style.removeProperty(property))

    // Handle system theme
    if (mode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)

      if (systemPalette) {
        root.classList.add('system')
        root.style.setProperty('--system-accent', systemPalette.accent)
      }
      return
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
