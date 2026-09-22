import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { randomInt } from 'node:crypto'
import { CACHE_TTL, STEAM_ROOT_PATHS } from '../../../shared/constants/app'
import type { PlaylistOrder, SteamConfig } from '../../../shared/constants/playlist'

let steamLibraryPathsCache: { value: string[]; timestamp: number; key: string } | null = null

export async function resolveSteamLibraryPaths(basePaths = STEAM_ROOT_PATHS): Promise<string[]> {
  const key = basePaths.join('\0')
  if (
    steamLibraryPathsCache?.key === key &&
    Date.now() - steamLibraryPathsCache.timestamp <= CACHE_TTL
  ) {
    return steamLibraryPathsCache.value
  }

  const libraries = new Set<string>()

  for (const basePath of basePaths) {
    const expanded = basePath.startsWith('~')
      ? path.join(process.env.HOME ?? '', basePath.slice(1))
      : basePath
    libraries.add(expanded)

    const libraryFoldersPath = path.join(expanded, 'steamapps/libraryfolders.vdf')
    try {
      const data = await fs.readFile(libraryFoldersPath, 'utf-8')
      const matches = data.matchAll(/"path"\s+"([^"]+)"/g)
      for (const match of matches) {
        libraries.add(match[1].replace(/\\\\/g, '\\'))
      }
    } catch {
      /* path may not be a Steam root */
    }
  }

  const value = [...libraries]
  steamLibraryPathsCache = { value, timestamp: Date.now(), key }
  return value
}

export async function resolveWallpaperEngineAssetsDir(
  basePaths?: string[],
): Promise<string | null> {
  const steamLibraryPaths = await resolveSteamLibraryPaths(basePaths)

  for (const steamLibraryPath of steamLibraryPaths) {
    const assetsDir = path.join(steamLibraryPath, 'steamapps/common/wallpaper_engine/assets')
    try {
      await fs.access(assetsDir)
      return assetsDir
    } catch {
      /* path doesn't exist */
    }
  }

  return null
}

const DEFAULT_CONFIG: SteamConfig = {
  steamuser: {
    general: { playlists: [] },
    wallpaperconfig: { selectedwallpapers: {} },
  },
}

export async function findSteamConfigPath(): Promise<string | null> {
  const steamLibraryPaths = await resolveSteamLibraryPaths()

  for (const steamLibraryPath of steamLibraryPaths) {
    const configPath = path.join(steamLibraryPath, 'steamapps/common/wallpaper_engine/config.json')
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

  const steamLibraryPaths = await resolveSteamLibraryPaths()

  for (const steamLibraryPath of steamLibraryPaths) {
    const configDir = path.join(steamLibraryPath, 'steamapps/common/wallpaper_engine')
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

type RandomIndex = (maxExclusive: number) => number

/** Unbiased Fisher–Yates. Every item has an equal chance of ending up first. */
function shuffle(items: readonly string[], getRandomIndex: RandomIndex): string[] {
  const shuffled = [...items]
  for (let currentIndex = shuffled.length - 1; currentIndex > 0; currentIndex--) {
    const selectedIndex = getRandomIndex(currentIndex + 1)
    const selectedItem = shuffled[selectedIndex]
    shuffled[selectedIndex] = shuffled[currentIndex]
    shuffled[currentIndex] = selectedItem
  }
  return shuffled
}

/**
 * EXPERIMENTAL — workaround for an upstream linux-wallpaperengine bug.
 *
 * Why this exists: when a playlist is launched with `--playlist`, the backend
 * shuffles internally but then seeks back to `playlist.items.front()` on
 * startup, so a "random" playlist always opens on the same (first) wallpaper.
 * See jagrat7/linux-wallpaper-engine#81 and upstream Almamu/linux-wallpaperengine.
 *
 * How it works around it: for random playlists we pre-shuffle the persisted
 * item order before the backend reads config.json, so whatever the backend
 * forces as `items[0]` is itself random. Returns the input unchanged for
 * non-random or single-item playlists. Pure — does not mutate `items`.
 *
 * CAUTION: this reorders the items the backend persists, not just the start
 * index. It is a stopgap, not the intended design — remove it (and its single
 * call site in playlist.ts) once upstream stops seeking to items.front().
 */
export function experimentalRandomizeStartItem(
  items: string[],
  order: PlaylistOrder,
  getRandomIndex: RandomIndex = randomInt,
): string[] {
  if (order !== 'random') return items
  if (items.length <= 1) return items
  return shuffle(items, getRandomIndex)
}
