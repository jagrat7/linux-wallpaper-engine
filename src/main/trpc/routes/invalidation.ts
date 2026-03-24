import { observable } from '@trpc/server/observable'
import { trpc } from '../trpc'
import { type InvalidationKey, invalidationService } from '../../services/invalidation'

export const invalidationRouter = trpc.router({
  onInvalidate: trpc.procedure.subscription(() => {
    return observable<InvalidationKey>((emit) => {
      return invalidationService.subscribe((key) => emit.next(key))
    })
  }),
})
