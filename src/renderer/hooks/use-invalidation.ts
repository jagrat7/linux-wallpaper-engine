import { trpc, queryClient } from "@/lib/trpc"

export function useInvalidation() {
    trpc.invalidation.onInvalidate.useSubscription(undefined, {
        onData(queryKey) {
            queryClient.invalidateQueries({ queryKey: [queryKey.split('.')] })
        },
    })
}
