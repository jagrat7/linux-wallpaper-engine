import { trpc, queryClient } from '@/lib/trpc'

export function useInvalidation() {
  trpc.invalidation.onInvalidate.useSubscription(undefined, {
    onData(queryKey) {
      const [router] = queryKey.split('.')
      queryClient.invalidateQueries({ queryKey: [[router]] })
    },
  })
}
