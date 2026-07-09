import { trpc } from '../trpc'
import { systemThemeService } from '../../services/system-theme'

export const systemThemeRouter = trpc.router({
  get: trpc.procedure.query(() => systemThemeService.get()),
})
