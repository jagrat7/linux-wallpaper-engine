
import type { AgeRating, WallpaperType } from '../../../shared/constants/wallpaper'

export interface WorkshopDownloadProgress {
  current: number
  total: number
}

export interface WorkshopStatus {
  path: string | null
  sizeOnDisk: number | null
  updatedAt: number | null
  download: WorkshopDownloadProgress | null
}

export interface WorkshopQueryOptions {
  search?: string
  page?: number
}

export interface WorkshopItem {
  id: string
  title: string
  author: string
  ageRating?: AgeRating
  type: WallpaperType
  tags: string[]
  previewUrl?: string
}

export interface WorkshopDiscoverSection {
  id: string
  title: string
  items: WorkshopItem[]
}

export interface WorkshopDiscoverResult {
  sections: WorkshopDiscoverSection[]
}

export interface WorkshopQueryResult {
  items: WorkshopItem[]
  page: number
  totalResults: number
  returnedResults: number
  hasNextPage: boolean
}
