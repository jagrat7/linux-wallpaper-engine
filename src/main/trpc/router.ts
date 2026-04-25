import { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { trpc } from './trpc'
import { invalidationRouter } from './routes/invalidation'
import { wallpaperRouter } from './routes/wallpaper'
import { displayRouter } from './routes/display'
import { settingsRouter } from './routes/settings'
import { windowRouter } from './routes/window'
import { playlistRouter } from './routes/playlist'
import { workshopRouter } from './routes/workshop'

export const appRouter = trpc.router({
  health: trpc.procedure.query(() => ({ status: 'ok' })),
  invalidation: invalidationRouter,
  wallpaper: wallpaperRouter,
  display: displayRouter,
  settings: settingsRouter,
  window: windowRouter,
  playlist: playlistRouter,
  workshop: workshopRouter,
})

export type AppRouter = typeof appRouter
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
