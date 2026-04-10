import { z } from 'zod'
import { trpc } from '../trpc'
import { workshopService } from '../../services/workshop/workshop'

export const workshopRouter = trpc.router({
  getItems: trpc.procedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
      }),
    )
    .query(async ({ input }) => {
      return workshopService.query(input)
    }),

  discover: trpc.procedure
    .query(async () => {
      return workshopService.discover()
    }),

  subscribe: trpc.procedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(async ({ input }) => {
      return workshopService.subscribe(input.workshopId)
    }),

  unsubscribe: trpc.procedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(async ({ input }) => {
      return workshopService.unsubscribe(input.workshopId)
    }),

  status: trpc.procedure
    .input(z.object({ workshopId: z.string() }))
    .query(async ({ input }) => {
      return workshopService.status(input.workshopId)
    }),
})
