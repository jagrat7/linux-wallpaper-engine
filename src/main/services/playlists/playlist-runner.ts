import type { ChildProcess } from 'node:child_process'
import { playlistService } from './playlist'
import { settingsService } from '../settings'
import { hostCommandExists, hostExecAsync, hostSpawn } from '../../utils/host'
import { resolveWallpaperEngineAssetsDir } from '../wallpaper/wallpaper.utils'
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE, applyOverridesToSettings, type ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'
import { startPlaylistScheduler, stopPlaylistScheduler, type SchedulerDeps } from './playlist-scheduler'
import type { MutationResult } from '../wallpaper/wallpaper.types'

// Injected by the caller to avoid a circular import with the wallpaper service
// (which uses this module to restart playlists when screens are released).
export type RegisterProcessFn = (
  screens: string[],
  proc: ChildProcess,
  args: string[],
  options: ApplyWallpaperOptions,
) => void | Promise<unknown>

export interface PlaylistStartCallbacks extends SchedulerDeps {
  register: RegisterProcessFn
}

export async function startPlaylistProcess(
  playlistName: string,
  screens: string[],
  stampLastApplied: boolean,
  callbacks: PlaylistStartCallbacks,
): Promise<MutationResult> {
  const playlist = await playlistService.getPlaylist(playlistName)
  if (!playlist) {
    return { success: false, error: 'Playlist not found' }
  }

  if (playlist.items.length === 0) {
    return { success: false, error: 'Playlist has no wallpapers' }
  }

  if (!await hostCommandExists('linux-wallpaperengine')) {
    return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
  }

  if (playlist.settings.mode === 'time' || playlist.settings.mode === 'theme') {
    if (!playlist.settings.schedule || playlist.settings.schedule.length === 0) {
      return { success: false, error: `Playlist has no ${playlist.settings.mode === 'time' ? 'time slots' : 'theme slots'}` }
    }

    try {
      const screenKeys = await startPlaylistScheduler(playlistName, playlist, screens, callbacks)
      playlistService.setActivePlaylist(playlistName, screenKeys)
      return { success: true, screens: screenKeys }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to start ${playlist.settings.mode} playlist`,
      }
    }
  }

  if (stampLastApplied) {
    await playlistService.stampLastApplied(playlistName)
  }

  const settings = await settingsService.loadSettings()
  const screenKeys = settings.windowMode ? ['default'] : screens
  const settingsArgs = settingsService.settingsToArgs(applyOverridesToSettings(settings, playlist.settings.overrides))
  const assetsDir = settings.assetsDir ?? await resolveWallpaperEngineAssetsDir()
  const args: string[] = []
  if (!settings.windowMode) {
    for (const screen of screenKeys) {
      args.push('--screen-root', screen)
    }
  }
  args.push('--playlist', playlistName)
  args.push(...settingsArgs)
  if (!settings.assetsDir && assetsDir) {
    args.push('--assets-dir', assetsDir)
  }

  try {
    // Kill orphaned processes so a restart can't double-spawn on a screen
    if (!settings.windowMode) {
      for (const screen of screenKeys) {
        try {
          await hostExecAsync(`pkill -9 -f "linux-wallpaperengine.*--screen-root.*${screen}"`)
        } catch { /* no process found is ok */ }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const debugMode = settingsService.getSetting('debugMode')
    const proc = hostSpawn('linux-wallpaperengine', args, {
      detached: true,
      stdio: debugMode
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'ignore', 'pipe'],
    })

    await callbacks.register(screenKeys, proc, args, {
      backgroundId: playlist.items[0],
      screen: settings.windowMode ? undefined : screens.length === 1 ? screens[0] : undefined,
    })

    playlistService.setActivePlaylist(playlistName, screenKeys)

    return { success: true, screens: screenKeys }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply playlist',
    }
  }
}

export { stopPlaylistScheduler }
