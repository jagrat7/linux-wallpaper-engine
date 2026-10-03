import { CACHE_TTL } from '../../../shared/constants/app'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import type { TimedCache } from './wallpaper.utils'

// All catalog readers share one scan. Invalidation during a scan queues a new scan
// before any reader receives a result, so an older scan cannot refill the cache.
export class WallpaperCatalogCache {
  private entry: TimedCache<Wallpaper[]> | null = null
  private pending: Promise<Wallpaper[]> | null = null
  private revision = 0
  private forceAgeRatings = false

  constructor(private readonly load: (forceAgeRatings: boolean) => Promise<Wallpaper[]>) {}

  invalidate(forceAgeRatings = false): void {
    this.entry = null
    this.revision += 1
    this.forceAgeRatings ||= forceAgeRatings
  }

  get(): Promise<Wallpaper[]> {
    if (this.pending) return this.pending
    if (this.entry && Date.now() - this.entry.timestamp <= CACHE_TTL) {
      return Promise.resolve(this.entry.value)
    }
    this.pending = this.loadCurrent().finally(() => {
      this.pending = null
    })
    return this.pending
  }

  private async loadCurrent(): Promise<Wallpaper[]> {
    while (true) {
      const revision = this.revision
      const forceAgeRatings = this.forceAgeRatings
      this.forceAgeRatings = false
      const value = await this.load(forceAgeRatings)
      if (revision !== this.revision) continue
      this.entry = { value, timestamp: Date.now() }
      return value
    }
  }
}
