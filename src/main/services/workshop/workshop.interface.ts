import type { WorkshopItem, WorkshopStatus } from './workshop.types'

export interface IWorkshopService {
  query(search?: string): Promise<WorkshopItem[]>
  subscribe(workshopId: string): Promise<boolean>
  unsubscribe(workshopId: string): Promise<boolean>
  status(workshopId: string): Promise<WorkshopStatus | null>
}
