import { WORKSHOP_AGE_RATING_TTL } from '../../../shared/constants/workshop'
import type { Wallpaper, WorkshopAgeRatings } from '../../../shared/constants/wallpaper'
import { storeService } from '../store'
import { workshopService } from '../workshop/workshop'

// Keep cached ratings usable offline, but refresh old tags and remember unclassified items.
export async function enrichAgeRatings(wallpapers: Wallpaper[], force = false): Promise<void> {
  let cached: WorkshopAgeRatings = {}
  try {
    const store = storeService.workshopMetadata
    cached = { ...store.get('ageRatings') }
    const checkedAt = { ...store.get('checkedAt') }
    const now = Date.now()
    const ids = [...new Set(wallpapers.map((wallpaper) => wallpaper.workshopId ?? wallpaper.id))]
    const staleIds = ids.filter(
      (id) =>
        force ||
        cached[id] === undefined ||
        checkedAt[id] === undefined ||
        now - checkedAt[id] >= WORKSHOP_AGE_RATING_TTL,
    )
    if (staleIds.length > 0) {
      const fetched = await workshopService.getAgeRatings(staleIds)
      // Only mark items actually returned by Steam as checked. Missing responses remain retryable.
      for (const id of staleIds) {
        if (fetched[id] === undefined) continue
        cached[id] = fetched[id]
        checkedAt[id] = now
      }
      store.set({ ageRatings: cached, checkedAt })
    }
  } catch (error) {
    console.warn('[enrichAgeRatings] Steam unavailable — age ratings not refreshed', error)
  }

  for (const wallpaper of wallpapers) {
    wallpaper.ageRating = cached[wallpaper.workshopId ?? wallpaper.id] ?? undefined
  }
}
