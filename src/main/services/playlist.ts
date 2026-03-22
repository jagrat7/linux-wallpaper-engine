import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { STEAM_PATHS, type Playlist, type SteamConfig } from '../../shared/constants'

class PlaylistService {
  private static instance: PlaylistService | null = null
  private configPath: string | null = null

  static getInstance(): PlaylistService {
    if (!PlaylistService.instance) {
      PlaylistService.instance = new PlaylistService()
    }
    return PlaylistService.instance
  }

  private expandPath(p: string): string {
    if (p.startsWith('~')) {
      return path.join(process.env.HOME ?? '', p.slice(1))
    }
    return p
  }

  async findConfigPath(): Promise<string | null> {
    if (this.configPath) {
      try {
        await fs.access(this.configPath)
        return this.configPath
      } catch {
        this.configPath = null
      }
    }

    for (const basePath of STEAM_PATHS) {
      const expanded = this.expandPath(basePath)
      const configPath = path.join(expanded, 'steamapps/common/wallpaper_engine/config.json')
      try {
        await fs.access(configPath)
        this.configPath = configPath
        return configPath
      } catch {
        // Continue searching
      }
    }

    return null
  }

  private async ensureConfigExists(): Promise<string> {
    const configPath = await this.findConfigPath()
    if (configPath) return configPath

    // Create a new config in the first available Steam path
    for (const basePath of STEAM_PATHS) {
      const expanded = this.expandPath(basePath)
      const configDir = path.join(expanded, 'steamapps/common/wallpaper_engine')
      const configPath = path.join(configDir, 'config.json')

      try {
        await fs.mkdir(configDir, { recursive: true })
        const defaultConfig: SteamConfig = {
          steamuser: {
            general: { playlists: [] },
            wallpaperconfig: { selectedwallpapers: {} },
          },
        }
        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
        this.configPath = configPath
        return configPath
      } catch {
        // Continue to next path
      }
    }

    throw new Error('Could not find or create Wallpaper Engine config.json')
  }

  private async readConfig(): Promise<SteamConfig> {
    const configPath = await this.ensureConfigExists()
    const defaultConfig: SteamConfig = {
      steamuser: {
        general: { playlists: [] },
        wallpaperconfig: { selectedwallpapers: {} },
      },
    }
    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(content)
      // The real Wallpaper Engine config.json may exist but lack the keys we
      // need (e.g. on a fresh install where playlists were never used).
      // Normalise the structure so callers can always assume it is present.
      parsed.steamuser ??= defaultConfig.steamuser
      parsed.steamuser.general ??= { playlists: [] }
      parsed.steamuser.general.playlists ??= []
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultConfig
      }

      throw error
    }
  }

  private async writeConfig(config: SteamConfig): Promise<void> {
    const configPath = await this.ensureConfigExists()

    // Create backup before writing
    try {
      await fs.copyFile(configPath, `${configPath}.backup`)
    } catch {
      // Ignore backup errors
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
  }

  async getPlaylists(): Promise<Playlist[]> {
    const config = await this.readConfig()
    return config.steamuser?.general?.playlists ?? []
  }

  async getPlaylist(name: string): Promise<Playlist | null> {
    const playlists = await this.getPlaylists()
    return playlists.find(p => p.name === name) ?? null
  }

  async createPlaylist(playlist: Playlist): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.readConfig()

      if (!config.steamuser.general.playlists) {
        config.steamuser.general.playlists = []
      }

      // Check for duplicate name
      if (config.steamuser.general.playlists.some(p => p.name === playlist.name)) {
        return { success: false, error: 'A playlist with this name already exists' }
      }

      // Validate items exist
      for (const itemPath of playlist.items) {
        try {
          await fs.access(itemPath)
        } catch {
          return { success: false, error: `Wallpaper path does not exist: ${itemPath}` }
        }
      }

      config.steamuser.general.playlists.push({ ...playlist, updatedAt: Date.now() })
      await this.writeConfig(config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create playlist' }
    }
  }

  async updatePlaylist(name: string, playlist: Playlist): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.readConfig()

      if (!config.steamuser.general.playlists) {
        return { success: false, error: 'No playlists exist' }
      }

      const index = config.steamuser.general.playlists.findIndex(p => p.name === name)
      if (index === -1) {
        return { success: false, error: 'Playlist not found' }
      }

      // If renaming, check for duplicate
      if (name !== playlist.name) {
        if (config.steamuser.general.playlists.some(p => p.name === playlist.name)) {
          return { success: false, error: 'A playlist with this name already exists' }
        }
      }

      // Validate items exist
      for (const itemPath of playlist.items) {
        try {
          await fs.access(itemPath)
        } catch {
          return { success: false, error: `Wallpaper path does not exist: ${itemPath}` }
        }
      }

      config.steamuser.general.playlists[index] = { ...playlist, updatedAt: Date.now() }
      await this.writeConfig(config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update playlist' }
    }
  }

  async deletePlaylist(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.readConfig()

      if (!config.steamuser.general.playlists) {
        return { success: false, error: 'No playlists exist' }
      }

      const index = config.steamuser.general.playlists.findIndex(p => p.name === name)
      if (index === -1) {
        return { success: false, error: 'Playlist not found' }
      }

      config.steamuser.general.playlists.splice(index, 1)
      await this.writeConfig(config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete playlist' }
    }
  }

  /** Lightweight timestamp update — skips item-path validation so it can't silently fail. */
  async stampLastApplied(name: string): Promise<void> {
    try {
      const config = await this.readConfig()
      const playlist = config.steamuser?.general?.playlists?.find(p => p.name === name)
      if (!playlist) return

      playlist.lastAppliedAt = Date.now()
      await this.writeConfig(config)
    } catch {
      // Best-effort — don't block the apply flow
    }
  }
}

export const playlistService = PlaylistService.getInstance()
