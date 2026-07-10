import { z } from 'zod'
import { trpc } from '../trpc'
import { playlistService } from '../../services/playlists/playlist'
import { startPlaylistProcess, stopPlaylistScheduler } from '../../services/playlists/playlist-runner'
import { wallpaperService } from '../../services/wallpaper/wallpaper'
import { settingsService } from '../../services/settings'
import { displayService } from '../../services/display'
import { PLAYLIST_TIME_UNIT_VALUES, PLAYLIST_ORDER_VALUES, PLAYLIST_MODE_VALUES } from '../../../shared/constants/playlist'
import { engineOverridesSchema } from '../../../shared/constants/wallpaper'
import type { ApplyWallpaperOptions } from '../../../shared/constants/wallpaper'

const playlistSettingsSchema = z.object({
  delay: z.number().min(1),
  timeunit: z.enum(PLAYLIST_TIME_UNIT_VALUES),
  mode: z.enum(PLAYLIST_MODE_VALUES),
  order: z.enum(PLAYLIST_ORDER_VALUES),
  updateonpause: z.boolean(),
  videosequence: z.boolean(),
  schedule: z.array(z.object({
    wallpaperPath: z.string().min(1),
    time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  })).optional(),
  overrides: engineOverridesSchema.optional(),
})

function startPlaylist(playlistName: string, screens: string[], stampLastApplied: boolean) {
  return startPlaylistProcess(playlistName, screens, stampLastApplied, {
    register: (screenKeys, proc, args, options) =>
      wallpaperService.apply({ kind: 'register', screens: screenKeys, proc, args, options }),
    apply: (options: ApplyWallpaperOptions) =>
      wallpaperService.apply({ kind: 'wallpaper', options }),
    stop: (screensToStop?: string[]) =>
      wallpaperService.stop(screensToStop),
  })
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
          const result = await startPlaylist(playlistName, remainingScreens, false)
          if (!result.success) return result
        } else {
          stopPlaylistScheduler(playlistName)
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

      return startPlaylist(input.playlistName, targetScreens, true)
    }),

  // Get currently active playlist info
  active: trpc.procedure.query(() => {
    return playlistService.getActivePlaylists()
  }),
})
