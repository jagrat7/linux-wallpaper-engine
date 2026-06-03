import { z } from 'zod'
import { trpc } from '../trpc'
import { playlistService } from '../../services/playlists/playlist'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { settingsService } from '../../services/settings'
import { displayService } from '../../services/display'
import { hostCommandExists, hostSpawn } from '../../utils/host'
import { resolveWallpaperEngineAssetsDir } from '../../services/wallpaper/wallpaper.utils'
import { PLAYLIST_TIME_UNIT_VALUES, PLAYLIST_ORDER_VALUES, PLAYLIST_MODE_VALUES } from '../../../shared/constants/playlist'
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE } from '../../../shared/constants/wallpaper'

const playlistSettingsSchema = z.object({
  delay: z.number().min(1),
  timeunit: z.enum(PLAYLIST_TIME_UNIT_VALUES),
  mode: z.enum(PLAYLIST_MODE_VALUES),
  order: z.enum(PLAYLIST_ORDER_VALUES),
  updateonpause: z.boolean(),
  videosequence: z.boolean(),
})

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
  stop: trpc.procedure.mutation(async () => {
    const active = playlistService.getActivePlaylist()
    if (!active) return { success: true }
    await wallpaperService.stop(active.screen)
    playlistService.clearActivePlaylist()
    return { success: true }
  }),

  // Start playlist on screen
  start: trpc.procedure
    .input(z.object({
      playlistName: z.string(),
      screen: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const playlist = await playlistService.getPlaylist(input.playlistName)
      if (!playlist) {
        return { success: false, error: 'Playlist not found' }
      }

      if (playlist.items.length === 0) {
        return { success: false, error: 'Playlist has no wallpapers' }
      }

      if (!await hostCommandExists('linux-wallpaperengine')) {
        return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
      }

      const preparedPlaylist = await playlistService.preparePlaylistForStart(input.playlistName)
      if (!preparedPlaylist) {
        return { success: false, error: 'Playlist not found' }
      }

      // Get target screen
      let targetScreen = input.screen
      if (!targetScreen) {
        const displays = await displayService.detectDisplays()
        const primary = displays.find(d => d.primary) ?? displays[0]
        if (primary) {
          targetScreen = primary.name
        }
      }

      // Stop existing wallpaper on this screen first
      await wallpaperService.stop(targetScreen)

      // Build command args for playlist mode with user settings
      const settings = await settingsService.loadSettings()
      const settingsArgs = settingsService.settingsToArgs(settings)
      const assetsDir = settings.assetsDir ?? await resolveWallpaperEngineAssetsDir()
      const args: string[] = []
      if (targetScreen && !settings.windowMode) {
        args.push('--screen-root', targetScreen)
      }
      args.push('--playlist', input.playlistName)
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

        const screenKey = settings.windowMode ? 'default' : (targetScreen ?? 'default')
        await wallpaperService.apply({
          kind: 'register',
          screen: screenKey,
          proc,
          args,
          options: {
            backgroundId: preparedPlaylist.items[0],
            screen: settings.windowMode ? undefined : targetScreen,
          },
        })

        playlistService.setActivePlaylist(input.playlistName, screenKey)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to apply playlist',
        }
      }
    }),

  // Get currently active playlist info
  active: trpc.procedure.query(() => {
    return playlistService.getActivePlaylist()
  }),
})
