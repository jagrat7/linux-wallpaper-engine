import type { WorkshopDiscoverResult, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'

export type WorkshopConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'user_disconnected'

export interface IWorkshopService {
  /**
   * Returns the current Steam connection status.
   */
  getConnectionStatus(): WorkshopConnectionStatus

  /**
   * Drops the active Steam connection, releasing Workshop API polling so Steam can exit cleanly.
   * The connection monitor will not auto-recover from this state until `reconnect` is called.
   */
  disconnect(): void

  /**
   * Resets the connection to idle and attempts to initialize the Steam client.
   * Used to recover from a user-initiated disconnect.
   */
  reconnect(): Promise<void>

  /**
   * Queries Wallpaper Engine Workshop items with the current app filter settings applied.
   *
   * @param options Optional Workshop query options such as search text and page number.
   * @returns A paginated Workshop query result.
   */
  query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult>

  /**
   * Loads curated Workshop sections for the default discover experience.
   *
   * @returns A discover payload containing curated Workshop sections.
   */
  discover(): Promise<WorkshopDiscoverResult>

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
   * Returns the current Workshop item status, including local install info and active download progress when available.
   *
   * @param workshopId The published Workshop file id.
   * @returns The current Workshop status, or `null` when the item is unavailable.
   */
  status(workshopId: string): Promise<WorkshopStatus | null>
}
