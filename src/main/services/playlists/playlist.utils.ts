import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { STEAM_PATHS } from '../../../shared/constants/app'
import type { SteamConfig } from '../../../shared/constants/playlist'
import { expandPath } from '../wallpaper/wallpaper.utils'

const DEFAULT_CONFIG: SteamConfig = {
  steamuser: {
    general: { playlists: [] },
    wallpaperconfig: { selectedwallpapers: {} },
  },
}

export async function findSteamConfigPath(): Promise<string | null> {
  for (const basePath of STEAM_PATHS) {
    const expanded = expandPath(basePath)
    const configPath = path.join(expanded, 'steamapps/common/wallpaper_engine/config.json')
    try {
      await fs.access(configPath)
      return configPath
    } catch {
      // Continue searching
    }
  }
  return null
}

export async function ensureSteamConfigPath(): Promise<string> {
  const existing = await findSteamConfigPath()
  if (existing) return existing

  for (const basePath of STEAM_PATHS) {
    const expanded = expandPath(basePath)
    const configDir = path.join(expanded, 'steamapps/common/wallpaper_engine')
    const configPath = path.join(configDir, 'config.json')

    try {
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return configPath
    } catch {
      // Continue to next path
    }
  }

  throw new Error('Could not find or create Wallpaper Engine config.json')
}

export async function readSteamConfig(configPath: string): Promise<SteamConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    // Normalise structure so callers can always assume keys are present
    parsed.steamuser ??= DEFAULT_CONFIG.steamuser
    parsed.steamuser.general ??= { playlists: [] }
    parsed.steamuser.general.playlists ??= []
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return structuredClone(DEFAULT_CONFIG)
    }
    throw error
  }
}

export async function writeSteamConfig(configPath: string, config: SteamConfig): Promise<void> {
  // Create backup before writing
  try {
    await fs.copyFile(configPath, `${configPath}.backup`)
  } catch {
    // Ignore backup errors
  }
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
}
