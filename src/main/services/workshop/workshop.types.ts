
export interface WorkshopStatus {
  path: string
  sizeOnDisk: number
  updatedAt: number
}

export interface WorkshopItem {
  id: string
  title: string
  author: string
  tags: string[]
  previewUrl?: string
}
