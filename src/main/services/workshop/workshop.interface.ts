import type { WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'

export interface IWorkshopService {
  /**
   * Queries Wallpaper Engine Workshop items with the current app filter settings applied.
   *
   * @param options Optional Workshop query options such as search text and page number.
   * @returns A paginated Workshop query result.
   */
  query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult>

  /**
   * Subscribes the current Steam user to a Workshop item by its published file id.
   *
   * @param workshopId The published Workshop file id.
   * @returns `true` when the subscribe request succeeds, otherwise `false`.
   */
  subscribe(workshopId: string): Promise<boolean>

  /**
   * Unsubscribes the current Steam user from a Workshop item by its published file id.
   *
   * @param workshopId The published Workshop file id.
   * @returns `true` when the unsubscribe request succeeds, otherwise `false`.
   */
  unsubscribe(workshopId: string): Promise<boolean>

  /**
   * Returns local installation status for a Workshop item when it is available on disk.
   *
   * @param workshopId The published Workshop file id.
   * @returns The local install status, or `null` when the item is unavailable.
   */
  status(workshopId: string): Promise<WorkshopStatus | null>
}
