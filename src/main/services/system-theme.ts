import { existsSync, readFileSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { nativeTheme, systemPreferences } from 'electron'
import { invalidationService } from './invalidation'
import { parseColorsToml, toSystemPalette } from '../utils/omarchy-theme'
import type { SystemTheme, SystemThemeMode } from '../../shared/constants/theme'

const OMARCHY_CURRENT_DIR = path.join(homedir(), '.config', 'omarchy', 'current')
const OMARCHY_THEME_DIR = path.join(OMARCHY_CURRENT_DIR, 'theme')

const NOTIFY_DEBOUNCE_MS = 150

function readOmarchyTheme(): SystemTheme | null {
  const colorsPath = path.join(OMARCHY_THEME_DIR, 'colors.toml')
  try {
    const palette = toSystemPalette(parseColorsToml(readFileSync(colorsPath, 'utf-8')))
    if (!palette) return null

    // Omarchy marks light themes with an empty light.mode file in the theme root
    const mode: SystemThemeMode = existsSync(path.join(OMARCHY_THEME_DIR, 'light.mode'))
      ? 'light'
      : 'dark'

    return { source: 'omarchy', mode, palette }
  } catch {
    return null
  }
}

// Electron reads the accent from the XDG desktop portal on Linux and returns
// RRGGBBAA hex without a leading '#', or an empty string when the desktop
// doesn't expose one
function readAccentColor(): string | null {
  try {
    const accent = systemPreferences.getAccentColor()
    return typeof accent === 'string' && accent.length >= 6
      ? `#${accent.slice(0, 6)}`
      : null
  } catch {
    return null
  }
}

export const systemThemeService = {
  get(): SystemTheme {
    const omarchy = readOmarchyTheme()
    if (omarchy) return omarchy

    const mode: SystemThemeMode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    const accent = readAccentColor()
    if (accent) return { source: 'accent', mode, accent }

    return { source: 'none', mode }
  },

  startWatching(): void {
    let timer: NodeJS.Timeout | null = null
    const notify = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => invalidationService.emit('systemTheme.get'), NOTIFY_DEBOUNCE_MS)
    }

    nativeTheme.on('updated', notify)
    systemPreferences.on('accent-color-changed', notify)

    // Omarchy switches themes by atomically swapping the `theme` symlink,
    // so watch its parent directory for the rename
    if (existsSync(OMARCHY_CURRENT_DIR)) {
      try {
        watch(OMARCHY_CURRENT_DIR, notify)
      } catch {
        // Watching is best effort -- the theme still resolves on next launch
      }
    }
  },
}
