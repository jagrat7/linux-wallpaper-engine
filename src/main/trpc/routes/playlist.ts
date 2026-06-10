import { z } from 'zod'
import { trpc } from '../trpc'
import { playlistService } from '../../services/playlists/playlist'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { settingsService } from '../../services/settings'
import { displayService } from '../../services/display'
import { hostCommandExists, hostSpawn } from '../../utils/host'
import { resolveWallpaperEngineAssetsDir } from '../../services/wallpaper/wallpaper.utils'
import { PLAYLIST_TIME_UNIT_VALUES, PLAYLIST_ORDER_VALUES, PLAYLIST_MODE_VALUES } from '../../../shared/constants/playlist'
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE, applyOverridesToSettings, engineOverridesSchema } from '../../../shared/constants/wallpaper'

const playlistSettingsSchema = z.object({
  delay: z.number().min(1),
  timeunit: z.enum(PLAYLIST_TIME_UNIT_VALUES),
  mode: z.enum(PLAYLIST_MODE_VALUES),
  order: z.enum(PLAYLIST_ORDER_VALUES),
  updateonpause: z.boolean(),
  videosequence: z.boolean(),
  overrides: engineOverridesSchema.optional(),
})

async function startPlaylistProcess(playlistName: string, screens: string[], stampLastApplied: boolean) {
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
    const debugMode = settingsService.getSetting('debugMode')
    const proc = hostSpawn('linux-wallpaperengine', args, {
      detached: true,
      stdio: debugMode
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'ignore', 'pipe'],
    })

    await wallpaperService.apply({
      kind: 'register',
      screens: screenKeys,
      proc,
      args,
      options: {
        backgroundId: playlist.items[0],
        screen: settings.windowMode ? undefined : screens.length === 1 ? screens[0] : undefined,
      },
    })

    playlistService.setActivePlaylist(playlistName, screenKeys)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply playlist',
    }
  }
}

export const playlistRouter = trpc.router({
  // List all playlists
  list: trpc.procedure.query(async () => {
    return playlistService.getPlaylists()
  }),

  // Get single playlist by name
  get: trpc.procedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return playlistService.getPlaylist(input.name)
    }),

  // Create new playlist
  create: trpc.procedure
    .input(z.object({
      name: z.string().min(1),
      items: z.array(z.string()),
      settings: playlistSettingsSchema,
    }))
    .mutation(async ({ input }) => {
      return playlistService.createPlaylist(input)
    }),

  // Update existing playlist
  update: trpc.procedure
    .input(z.object({
      name: z.string(),
      playlist: z.object({
        name: z.string().min(1),
        items: z.array(z.string()),
        settings: playlistSettingsSchema,
      }),
    }))
    .mutation(async ({ input }) => {
      return playlistService.updatePlaylist(input.name, input.playlist)
    }),

  // Delete playlist
  delete: trpc.procedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      return playlistService.deletePlaylist(input.name)
    }),

  // Stop the currently active playlist
  stop: trpc.procedure
    .input(z.object({
      screen: z.string().optional(),
      playlistName: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const active = playlistService.getActivePlaylists()
      const targetScreens = active
        .filter(entry => (!input?.screen || entry.screen === input.screen) && (!input?.playlistName || entry.name === input.playlistName))
        .map(entry => entry.screen)
      if (targetScreens.length === 0) return { success: true }

      const targetScreenSet = new Set(targetScreens)
      const affectedPlaylistNames = new Set(
        active
          .filter(entry => targetScreenSet.has(entry.screen))
          .map(entry => entry.name)
      )

      for (const playlistName of affectedPlaylistNames) {
        const playlistScreens = active
          .filter(entry => entry.name === playlistName)
          .map(entry => entry.screen)
        const remainingScreens = playlistScreens.filter(screen => !targetScreenSet.has(screen))

        await wallpaperService.stop(playlistScreens)
        playlistService.clearActivePlaylist(playlistScreens)

        if (remainingScreens.length > 0) {
          const result = await startPlaylistProcess(playlistName, remainingScreens, false)
          if (!result.success) return result
        }
      }

      return { success: true }
    }),

  // Start playlist on screen
  start: trpc.procedure
    .input(z.object({
      playlistName: z.string(),
      screen: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const settings = await settingsService.loadSettings()
      const targetScreens = input.screen
        ? [input.screen]
        : settings.windowMode
          ? ['default']
          : (await displayService.detectDisplays()).map(d => d.name)

      await wallpaperService.stop(targetScreens)
      playlistService.clearActivePlaylist(targetScreens)

      return startPlaylistProcess(input.playlistName, targetScreens, true)
    }),

  // Get currently active playlist info
  active: trpc.procedure.query(() => {
    return playlistService.getActivePlaylists()
  }),
})
