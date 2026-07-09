import { trpc } from '../trpc'
import { getSystemThemePalette } from '../../services/system-theme'

export const systemThemeRouter = trpc.router({
  get: trpc.procedure.query(() => getSystemThemePalette()),
})
