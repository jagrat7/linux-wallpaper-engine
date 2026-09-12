import { trpc, queryClient } from "@/lib/trpc"

export function useInvalidation() {
    trpc.invalidation.onInvalidate.useSubscription(undefined, {
        onData(queryKey) {
            // Invalidation keys are router-path strings like 'wallpaper.applied'.
            // tRPC v11 query keys are [['router', 'procedure']], and a partial
            // prefix of [['router']] matches every query under that router —
            // matching on the full key (e.g. ['wallpaper','paused']) would
            // match nothing.
            const [router] = queryKey.split(".")
            queryClient.invalidateQueries({ queryKey: [[router]] })
        },
    })
}
