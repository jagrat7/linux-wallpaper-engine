import { z } from 'zod'
import { trpc } from '../trpc'
import { displayService } from '../../services/display'
import { settingsService } from '../../services/settings'

export const displayRouter = trpc.router({
  // List all connected displays
  list: trpc.procedure.query(async () => {
    return displayService.detectDisplays()
  }),

  // Get current display session type
  session: trpc.procedure.query(async () => {
    return { type: await displayService.getDisplaySession() }
  }),

  // Get maximum refresh rate across all displays
  maxRefreshRate: trpc.procedure.query(async () => {
    return { maxRefreshRate: await displayService.getMaxRefreshRate() }
  }),

  // TODO: Use settingsService to mutate display
  // Rename a display (override the detected name)
  rename: trpc.procedure
    .input(z.object({
      displayId: z.string(),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const overrides = settingsService.getSetting('displayNameOverrides')
      overrides[input.displayId] = input.name
      settingsService.setSetting('displayNameOverrides', overrides)
      return displayService.detectDisplays()
    }),

  // Reset a display name override back to detected name
  resetName: trpc.procedure
    .input(z.object({ displayId: z.string() }))
    .mutation(async ({ input }) => {
      const overrides = settingsService.getSetting('displayNameOverrides')
      delete overrides[input.displayId]
      settingsService.setSetting('displayNameOverrides', overrides)
      return displayService.detectDisplays()
    }),
})
