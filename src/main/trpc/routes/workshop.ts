import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { trpc } from '../trpc'
import { workshopService, type WorkshopConnectionEvent } from '../../services/workshop/workshop'
import { isWorkshopConnectionError } from '../../services/workshop/workshop.errors'
import { WORKSHOP_SORT_OPTIONS, type WorkshopSortBy } from '../../../shared/constants/workshop'

const workshopSortSchema = z.enum(WORKSHOP_SORT_OPTIONS.map(o => o.value) as [WorkshopSortBy, ...WorkshopSortBy[]])

const toTrpcWorkshopError = (error: unknown): never => {
  if (isWorkshopConnectionError(error)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: error.message,
      cause: error,
    })
  }

  throw error
}

const workshopProcedure = trpc.procedure.use(async (options) => {
  try {
    return await options.next()
  } catch (error) {
    return toTrpcWorkshopError(error)
  }
})

export const workshopRouter = trpc.router({
  onConnectionEvent: trpc.procedure.subscription(() => {
    return observable<WorkshopConnectionEvent>((emit) => {
      return workshopService.subscribeToConnectionEvents((event) => emit.next(event))
    })
  }),

  getItems: workshopProcedure
    .input(
      z.object({
        search: z.string().optional(),
        cursor: z.string().optional(),
        sortBy: workshopSortSchema.optional(),
      }),
    )
    .query(({ input }) => workshopService.query(input)),

  discover: workshopProcedure
    .input(
      z.object({
        sortBy: workshopSortSchema.optional(),
        focusedSectionId: z.string().optional(),
        page: z.number().int().positive().optional(),
      }).optional(),
    )
    .query(({ input }) => workshopService.discover(input)),

  subscribe: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(({ input }) => workshopService.subscribe(input.workshopId)),

  unsubscribe: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(({ input }) => workshopService.unsubscribe(input.workshopId)),

  status: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .query(({ input }) => workshopService.itemStatus(input.workshopId)),
})
