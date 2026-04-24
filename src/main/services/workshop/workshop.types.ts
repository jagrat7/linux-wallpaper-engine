
import type { AgeRating, WallpaperType } from '../../../shared/constants/wallpaper'
import type { WorkshopSortBy } from '../../../shared/constants/workshop'

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

export interface DiscoverSectionConfig {
  id: string
  title: string
  queryType: number
  requiredTags?: string[]
  rankedByTrendDays?: number
}

export interface WorkshopQueryOptions {
  search?: string
  cursor?: string
  sortBy?: WorkshopSortBy
}

export interface WorkshopDiscoverOptions {
  sortBy?: WorkshopSortBy
  focusedSectionId?: string
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
  page: number
  totalResults: number
  resultsPerPage: number
  hasNextPage: boolean
}

export interface WorkshopDiscoverResult {
  sections: WorkshopDiscoverSection[]
}

export interface WorkshopQueryResult {
  items: WorkshopItem[]
  page: number
  totalResults: number
  resultsPerPage: number
  returnedResults: number
  hasNextPage: boolean
}
