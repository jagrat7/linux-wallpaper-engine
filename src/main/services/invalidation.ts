import { EventEmitter } from 'node:events'

export type InvalidationKey = 'wallpaper.getWallpapers' | 'wallpaper.getCompatibilityMap' | 'wallpaper.applied' | 'wallpaper.stopped' | 'display.list'

const emitter = new EventEmitter()

export const invalidationService = {
  emit(key: InvalidationKey) {
    emitter.emit('invalidate', key)
  },
  subscribe(cb: (key: InvalidationKey) => void) {
    emitter.on('invalidate', cb)
    return () => { emitter.off('invalidate', cb) }
  },
}
