import { createContext, useContext, useLayoutEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../shared/constants/app'
import { THEME_OPTIONS, type ThemeOption } from '../../shared/constants/theme'
import { trpc } from '../lib/trpc'

const STORAGE_KEY = 'wallpaper-engine-theme'
const THEME_CLASSES = THEME_OPTIONS.map(option => option.value)
const cssVariable = (key: string) => `--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`
const preferredSystemScheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'

type ThemeProviderProps = {
  children: React.ReactNode
}

type ThemeProviderState = {
  mode: ThemeOption
  setMode: (mode: ThemeOption) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeOption>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeOption | null) ?? DEFAULT_SETTINGS.theme
  )
  const { data: systemTheme } = trpc.settings.systemTheme.useQuery(undefined, {
    enabled: mode === 'system',
  })

  useLayoutEffect(() => {
    const root = window.document.documentElement
    const paletteProperties: string[] = []

    root.classList.remove(...THEME_CLASSES)

    if (mode === 'system') {
      const resolvedScheme = systemTheme?.scheme ?? preferredSystemScheme()
      root.classList.add('system', resolvedScheme)

      Object.entries(systemTheme?.palette ?? {}).forEach(([key, value]) => {
        const property = cssVariable(key)
        root.style.setProperty(property, value)
        paletteProperties.push(property)
      })
    }
    else {
      root.classList.add(mode)
    }

    return () => {
      root.classList.remove(...THEME_CLASSES)
      paletteProperties.forEach(property => root.style.removeProperty(property))
    }
  }, [mode, systemTheme])

  const value = {
    mode,
    setMode: (newMode: ThemeOption) => {
      localStorage.setItem(STORAGE_KEY, newMode)
      setMode(newMode)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
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
