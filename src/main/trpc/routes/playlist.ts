import { z } from 'zod'
import { trpc } from '../trpc'
import { playlistService } from '../../services/playlist'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { displayService } from '../../services/display'
import { hostSpawn } from '../../services/flatpak'
import { PLAYLIST_TIME_UNIT_VALUES, PLAYLIST_ORDER_VALUES, PLAYLIST_MODE_VALUES } from '../../../shared/constants'

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
    const active = wallpaperService.getActivePlaylist()
    if (!active) return { success: true }
    await wallpaperService.stopWallpaper(active.screen)
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
      await wallpaperService.stopWallpaper(targetScreen)

      // Build command args for playlist mode
      const args: string[] = []
      if (targetScreen) {
        args.push('--screen-root', targetScreen)
      }
      args.push('--playlist', input.playlistName)

      try {
        // Spawn linux-wallpaperengine with --playlist flag
        // This makes it handle rotation automatically
        const proc = hostSpawn('linux-wallpaperengine', args, {
          detached: true,
          stdio: ['ignore', 'ignore', 'ignore'],
        })

        // Register the process with wallpaper service for proper tracking
        // (stop, restore, status bar)
        const screenKey = targetScreen ?? 'default'
        wallpaperService.registerProcess(screenKey, proc, {
          backgroundId: playlist.items[0],
          screen: targetScreen,
        })

        // Track which playlist is active
        wallpaperService.setActivePlaylist(input.playlistName, screenKey)

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
    return wallpaperService.getActivePlaylist()
  }),
})
