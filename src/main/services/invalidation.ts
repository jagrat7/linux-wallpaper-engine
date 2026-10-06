import { EventEmitter } from 'node:events'
import type { PlaybackInvalidationKey } from '../../shared/constants/wallpaper'

export type InvalidationKey =
  | 'wallpaper.getWallpapers'
  | 'wallpaper.getCompatibilityMap'
  | PlaybackInvalidationKey
  | 'display.list'
  | 'settings.systemTheme'

const emitter = new EventEmitter()

export const invalidationService = {
  emit(key: InvalidationKey) {
    emitter.emit('invalidate', key)
  },
  subscribe(cb: (key: InvalidationKey) => void) {
    emitter.on('invalidate', cb)
    return () => {
      emitter.off('invalidate', cb)
    }
  },
}
