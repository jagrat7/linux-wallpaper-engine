
export interface WorkshopStatus {
  path: string
  sizeOnDisk: number
  updatedAt: number
}

export interface WorkshopQueryOptions {
  search?: string
  page?: number
}

export interface WorkshopItem {
  id: string
  title: string
  author: string
  tags: string[]
  previewUrl?: string
}

export interface WorkshopQueryResult {
  items: WorkshopItem[]
  page: number
  totalResults: number
  returnedResults: number
  hasNextPage: boolean
}
