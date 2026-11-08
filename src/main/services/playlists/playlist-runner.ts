import type { playlistService } from './playlist'
import { settingsService } from '../settings'
import { hostCommandExists } from '../../utils/host'
import {
  BACKEND_NOT_INSTALLED_ERROR_MESSAGE,
  applyOverridesToSettings,
  type ApplyWallpaperOptions,
} from '../../../shared/constants/wallpaper'

// Starts the backend and records it against `screens`. Injected by the wallpaper
// service, which owns every backend, to avoid a circular import with it
export type LaunchBackendFn = (
  screens: string[],
  args: string[],
  options: ApplyWallpaperOptions,
) => Promise<unknown>

type PlaylistProcessService = Pick<
  typeof playlistService,
  'getPlaylist' | 'stampLastApplied' | 'resolveWallpaperEngineAssetsDir' | 'setActivePlaylist'
>

export async function startPlaylistProcess(
  service: PlaylistProcessService,
  playlistName: string,
  screens: string[],
  stampLastApplied: boolean,
  launch: LaunchBackendFn,
): Promise<{ success: boolean; error?: string }> {
  const playlist = await service.getPlaylist(playlistName)
  if (!playlist) {
    return { success: false, error: 'Playlist not found' }
  }

  if (playlist.items.length === 0) {
    return { success: false, error: 'Playlist has no wallpapers' }
  }

  if (!(await hostCommandExists('linux-wallpaperengine'))) {
    return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
  }

  if (stampLastApplied) {
    await service.stampLastApplied(playlistName)
  }

  const settings = await settingsService.loadSettings()
  const screenKeys = settings.windowMode ? ['default'] : screens
  const settingsArgs = settingsService.settingsToArgs(
    applyOverridesToSettings(settings, playlist.settings.overrides),
  )
  const assetsDir = settings.assetsDir ?? (await service.resolveWallpaperEngineAssetsDir())
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
    await launch(screenKeys, args, {
      backgroundId: playlist.items[0],
      screen: settings.windowMode ? undefined : screens.length === 1 ? screens[0] : undefined,
    })

    service.setActivePlaylist(playlistName, screenKeys)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply playlist',
    }
  }
}
