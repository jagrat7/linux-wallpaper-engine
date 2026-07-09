import { createContext, useContext, useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import {
  SYSTEM_PALETTE_KEYS,
  THEME_OPTIONS,
  type SystemTheme,
  type ThemeOption,
} from '../../shared/constants/theme'

// Derive type from constants - single source of truth
type ThemeMode = ThemeOption

// Helper class applied alongside .light/.dark when only an accent color is
// available (portal fallback, no full omarchy palette)
const ACCENT_ONLY_CLASS = 'system-accent'

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

function applySystemTheme(root: HTMLElement, systemTheme: SystemTheme) {
  root.classList.add(systemTheme.mode)

  if (systemTheme.source === 'omarchy') {
    Object.entries(systemTheme.palette).forEach(([key, value]) => {
      root.style.setProperty(`--system-${key}`, value)
    })
    root.classList.add('system-colors')
  } else if (systemTheme.source === 'accent') {
    root.style.setProperty('--system-accent', systemTheme.accent)
    root.classList.add(ACCENT_ONLY_CLASS)
  }
}

export function ThemeProvider({
  children,
  defaultMode = 'system',
  storageKey = 'wallpaper-engine-theme',
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(storageKey) as ThemeMode) ?? defaultMode
  )

  const { data: systemTheme } = trpc.systemTheme.get.useQuery(undefined, {
    enabled: mode === 'system-colors',
  })

  useEffect(() => {
    const root = window.document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      // Reset all theme classes and injected system palette variables
      THEME_OPTIONS.forEach((option) => {
        root.classList.remove(option.value)
      })
      root.classList.remove(ACCENT_ONLY_CLASS)
      SYSTEM_PALETTE_KEYS.forEach((key) => {
        root.style.removeProperty(`--system-${key}`)
      })

      // Handle system theme (light/dark follow only)
      if (mode === 'system') {
        root.classList.add(media.matches ? 'dark' : 'light')
        return
      }

      // Handle system colors (palette/accent pulled from the OS theme)
      if (mode === 'system-colors') {
        if (systemTheme) applySystemTheme(root, systemTheme)
        else root.classList.add(media.matches ? 'dark' : 'light')
        return
      }

      // Apply selected theme
      root.classList.add(mode)
    }

    applyTheme()

    // Re-apply when the OS light/dark preference flips
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
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
