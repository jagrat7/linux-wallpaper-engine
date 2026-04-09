import type { WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'

export interface IWorkshopService {
  query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult>
  subscribe(workshopId: string): Promise<boolean>
  unsubscribe(workshopId: string): Promise<boolean>
  status(workshopId: string): Promise<WorkshopStatus | null>
}
