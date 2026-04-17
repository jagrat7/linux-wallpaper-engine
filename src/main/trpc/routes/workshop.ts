import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { trpc } from '../trpc'
import { workshopService, type WorkshopConnectionEvent } from '../../services/workshop/workshop'
import { isWorkshopConnectionError } from '../../services/workshop/workshop.errors'

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

  connectionStatus: trpc.procedure.query(() => workshopService.getConnectionStatus()),

  disconnect: trpc.procedure.mutation(() => {
    workshopService.disconnect()
    return true
  }),

  reconnect: workshopProcedure.mutation(async () => {
    await workshopService.reconnect()
    return true
  }),

  getItems: workshopProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
      }),
    )
    .query(({ input }) => workshopService.query(input)),

  discover: workshopProcedure
    .query(() => workshopService.discover()),

  subscribe: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(({ input }) => workshopService.subscribe(input.workshopId)),

  unsubscribe: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .mutation(({ input }) => workshopService.unsubscribe(input.workshopId)),

  status: workshopProcedure
    .input(z.object({ workshopId: z.string() }))
    .query(({ input }) => workshopService.status(input.workshopId)),
})
