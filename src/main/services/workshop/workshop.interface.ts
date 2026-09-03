import type { WorkshopDiscoverOptions, WorkshopDiscoverResult, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import type { WorkshopConnectionEvent } from './workshop'
import type { AgeRating } from '@/../shared/constants/wallpaper'

export interface IWorkshopService {
  /**
   * Subscribes to Steam connection state transitions. While at least one subscriber
   * is active, the service polls for Steam availability and auto-connects when found.
   * Returns a teardown function that removes the listener and stops polling when the
   * subscriber count drops to zero.
   */
  subscribeToConnectionEvents(cb: (event: WorkshopConnectionEvent) => void): () => void

  /**
   * Queries Wallpaper Engine Workshop items with the current app filter settings applied.
   */
  query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult>

  /**
   * Loads curated Workshop sections for the default discover experience.
   */
  discover(options?: WorkshopDiscoverOptions): Promise<WorkshopDiscoverResult>

  /**
   * Subscribes the current Steam user to a Workshop item by its published file id.
   */
  subscribe(workshopId: string): Promise<boolean>

  /**
   * Unsubscribes the current Steam user from a Workshop item by its published file id.
   */
  unsubscribe(workshopId: string): Promise<boolean>

  /**
   * Returns the current Workshop item status, including local install info and
   * active download progress when available.
   */
  itemStatus(workshopId: string): Promise<WorkshopStatus | null>

  /**
   * Resolves age ratings for the given workshop item ids from Steam UGC tags.
   * Only numeric workshop ids are queried; unknown items are skipped.
   * Throws when Steam is unavailable (callers should catch).
   */
  getAgeRatings(workshopIds: string[]): Promise<Record<string, AgeRating>>
}
