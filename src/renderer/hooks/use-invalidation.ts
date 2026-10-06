import { trpc, queryClient } from '@/lib/trpc'
import { isPlaybackInvalidationKey } from '../../shared/constants/wallpaper'

export function useInvalidation() {
  const utils = trpc.useUtils()
  trpc.invalidation.onInvalidate.useSubscription(undefined, {
    onData(queryKey) {
      if (isPlaybackInvalidationKey(queryKey)) {
        // These events describe state changes, not procedure names. Update both
        // mounted clients immediately instead of waiting for their polling timers.
        void Promise.all([
          utils.wallpaper.getActiveWallpaper.invalidate(),
          utils.playlist.active.invalidate(),
        ])
      } else {
        void queryClient.invalidateQueries({ queryKey: [queryKey.split('.')] })
      }
    },
  })
}
