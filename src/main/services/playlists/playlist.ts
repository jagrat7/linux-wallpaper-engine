import * as fs from 'node:fs/promises'
import type { Playlist } from '../../../shared/constants/playlist'
import { storeService, type ActivePlaylistInfo } from '../store'
import { findSteamConfigPath, ensureSteamConfigPath, readSteamConfig, writeSteamConfig, experimentalRandomizeStartItem } from './playlist.utils'

class PlaylistService {
  private static instance: PlaylistService | null = null
  private configPath: string | null = null
  private playlistStore = storeService.activeWallpapers

  static getInstance(): PlaylistService {
    if (!PlaylistService.instance) {
      PlaylistService.instance = new PlaylistService()
    }
    return PlaylistService.instance
  }

  private async getConfigPath(): Promise<string> {
    if (this.configPath) {
      try {
        await fs.access(this.configPath)
        return this.configPath
      } catch {
        this.configPath = null
      }
    }

    const found = await findSteamConfigPath()
    if (found) {
      this.configPath = found
      return found
    }

    const created = await ensureSteamConfigPath()
    this.configPath = created
    return created
  }

  async getPlaylists(): Promise<Playlist[]> {
    const configPath = await this.getConfigPath()
    const config = await readSteamConfig(configPath)
    return config.steamuser?.general?.playlists ?? []
  }

  async getPlaylist(name: string): Promise<Playlist | null> {
    const playlists = await this.getPlaylists()
    return playlists.find(p => p.name === name) ?? null
  }

  async createPlaylist(playlist: Playlist): Promise<{ success: boolean; error?: string }> {
    try {
      const configPath = await this.getConfigPath()
      const config = await readSteamConfig(configPath)

      if (!config.steamuser.general.playlists) {
        config.steamuser.general.playlists = []
      }

      if (config.steamuser.general.playlists.some(p => p.name === playlist.name)) {
        return { success: false, error: 'A playlist with this name already exists' }
      }

      for (const itemPath of playlist.items) {
        try {
          await fs.access(itemPath)
        } catch {
          return { success: false, error: `Wallpaper path does not exist: ${itemPath}` }
        }
      }

      config.steamuser.general.playlists.push({ ...playlist, updatedAt: Date.now() })
      await writeSteamConfig(configPath, config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create playlist' }
    }
  }

  async updatePlaylist(name: string, playlist: Playlist): Promise<{ success: boolean; error?: string }> {
    try {
      const configPath = await this.getConfigPath()
      const config = await readSteamConfig(configPath)

      if (!config.steamuser.general.playlists) {
        return { success: false, error: 'No playlists exist' }
      }

      const index = config.steamuser.general.playlists.findIndex(p => p.name === name)
      if (index === -1) {
        return { success: false, error: 'Playlist not found' }
      }

      if (name !== playlist.name) {
        if (config.steamuser.general.playlists.some(p => p.name === playlist.name)) {
          return { success: false, error: 'A playlist with this name already exists' }
        }
      }

      for (const itemPath of playlist.items) {
        try {
          await fs.access(itemPath)
        } catch {
          return { success: false, error: `Wallpaper path does not exist: ${itemPath}` }
        }
      }

      config.steamuser.general.playlists[index] = { ...playlist, updatedAt: Date.now() }
      await writeSteamConfig(configPath, config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update playlist' }
    }
  }

  async deletePlaylist(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const configPath = await this.getConfigPath()
      const config = await readSteamConfig(configPath)

      if (!config.steamuser.general.playlists) {
        return { success: false, error: 'No playlists exist' }
      }

      const index = config.steamuser.general.playlists.findIndex(p => p.name === name)
      if (index === -1) {
        return { success: false, error: 'Playlist not found' }
      }

      config.steamuser.general.playlists.splice(index, 1)
      await writeSteamConfig(configPath, config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete playlist' }
    }
  }

  /** Lightweight timestamp update — skips item-path validation so it can't silently fail. */
  async stampLastApplied(name: string): Promise<void> {
    try {
      const configPath = await this.getConfigPath()
      const config = await readSteamConfig(configPath)
      const playlist = config.steamuser?.general?.playlists?.find(p => p.name === name)
      if (!playlist) return

      playlist.items = experimentalRandomizeStartItem(playlist.items, playlist.settings.order)
      playlist.lastAppliedAt = Date.now()
      await writeSteamConfig(configPath, config)
    } catch {
      // Best-effort — don't block the apply flow
    }
  }

  // ── Active playlist state ──────────────────────────────────────────────

  getActivePlaylists(): ActivePlaylistInfo[] {
    return Object.values(this.getActivePlaylistEntries())
  }

  getActivePlaylistEntries(): Record<string, ActivePlaylistInfo> {
    const entries = this.playlistStore.get('activePlaylists') ?? {}
    const legacy = this.playlistStore.get('activePlaylist')
    if (!legacy || entries[legacy.screen]) return entries
    return { ...entries, [legacy.screen]: legacy }
  }

  setActivePlaylist(name: string, screens: string[]): void {
    const entries = this.getActivePlaylistEntries()
    for (const screen of screens) {
      entries[screen] = { name, screen }
    }
    this.playlistStore.set('activePlaylists', entries)
    this.playlistStore.set('activePlaylist', null)
  }

  clearActivePlaylist(screens?: string[]): void {
    if (!screens) {
      this.playlistStore.set('activePlaylists', {})
      this.playlistStore.set('activePlaylist', null)
      return
    }

    const entries = this.getActivePlaylistEntries()
    for (const screen of screens) {
      delete entries[screen]
    }
    this.playlistStore.set('activePlaylists', entries)
    this.playlistStore.set('activePlaylist', null)
  }
}

export const playlistService = PlaylistService.getInstance()
