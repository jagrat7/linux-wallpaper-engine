import { createContext, useContext, useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { THEME_OPTIONS, type ThemeOption, isLightTheme, type SystemTheme } from '../../shared/constants/theme'
import {
  applySystemThemeStyle,
  buildSystemThemeCssVariables,
  getSystemResolvedScheme,
  removeSystemThemeStyle,
} from '@/lib/system-theme'

// Derive type from constants - single source of truth
type ThemeMode = ThemeOption

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: ThemeMode
  storageKey?: string
}

type ThemeProviderState = {
  mode: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const initialState: ThemeProviderState = {
  mode: 'system',
  resolvedTheme: 'dark',
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
    () => (localStorage.getItem(storageKey) as ThemeMode) ?? defaultMode,
  )

  const [systemTheme, setSystemTheme] = useState<SystemTheme | undefined>(undefined)
  const [prefersDark, setPrefersDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  const isSystem = mode === 'system'

  const { data: systemThemeQuery } = trpc.settings.getSystemTheme.useQuery(undefined, {
    enabled: isSystem,
  })

  trpc.settings.onSystemThemeChange.useSubscription(undefined, {
    onData: setSystemTheme,
    enabled: isSystem,
  })

  useEffect(() => {
    if (systemThemeQuery) setSystemTheme(systemThemeQuery)
  }, [systemThemeQuery])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = isSystem
    ? getSystemResolvedScheme(systemTheme, prefersDark)
    : isLightTheme(mode)
      ? 'light'
      : 'dark'

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes and the system marker
    THEME_OPTIONS.forEach((option) => {
      root.classList.remove(option.value)
    })
    root.classList.remove('system')
    removeSystemThemeStyle()

    if (mode === 'system') {
      root.classList.add(resolvedTheme, 'system')

      if (systemTheme) {
        const variables = buildSystemThemeCssVariables(systemTheme, resolvedTheme)
        applySystemThemeStyle(variables)
      }
      return
    }

    // Apply selected theme
    root.classList.add(mode)
  }, [mode, resolvedTheme, systemTheme])

  const value = {
    mode,
    resolvedTheme,
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
