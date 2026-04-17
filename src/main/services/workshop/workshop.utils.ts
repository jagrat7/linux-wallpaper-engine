import { AGE_RATINGS, FILTER_TYPE_OPTIONS, type AgeRating, type WallpaperFilterType, type WallpaperType } from '../../../shared/constants/wallpaper'
import type { AppSettings } from '../../../shared/constants/app'
import type { DiscoverSectionConfig, WorkshopItem } from './workshop.types'

export function parseWorkshopId(workshopId: string): bigint | null {
  const normalizedId = workshopId.trim()

  if (!/^\d+$/.test(normalizedId)) {
    return null
  }

  try {
    return BigInt(normalizedId)
  } catch {
    return null
  }
}

export function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER
  }

  return Number(value)
}

const WORKSHOP_TYPE_TAGS = Object.fromEntries(
  FILTER_TYPE_OPTIONS
    .filter((option): option is typeof FILTER_TYPE_OPTIONS[number] & { value: WallpaperType } => option.value !== 'all')
    .map(option => [option.value, option.label])
) as Record<WallpaperType, string>

export function parseWorkshopAgeRating(tags: string[]): AgeRating | undefined {
  const normalizedTags = new Set(tags.map(tag => tag.trim().toLowerCase()))

  for (const [ageRating, config] of Object.entries(AGE_RATINGS) as Array<[AgeRating, typeof AGE_RATINGS[AgeRating]]>) {
    if (normalizedTags.has(config.workshopTag.toLowerCase())) {
      return ageRating
    }
  }

  return undefined
}

export function parseWorkshopType(tags: string[]): WallpaperType {
  const normalizedTags = new Set(tags.map(tag => tag.trim().toLowerCase()))

  for (const [type, workshopTag] of Object.entries(WORKSHOP_TYPE_TAGS) as Array<[WallpaperType, string]>) {
    if (normalizedTags.has(workshopTag.toLowerCase())) {
      return type
    }
  }

  return 'scene'
}

export function toWorkshopResolutionTag(value: string): string | null {
  const normalizedValue = value.trim()

  if (!normalizedValue || normalizedValue === 'Unknown') {
    return null
  }

  if (normalizedValue === 'Dynamic resolution') {
    return normalizedValue
  }

  if (normalizedValue === 'Other resolution') {
    return normalizedValue
  }

  const resolutionMatch = normalizedValue.match(/^(\d+)x(\d+)$/i)

  if (!resolutionMatch) {
    return normalizedValue
  }

  return `${resolutionMatch[1]} x ${resolutionMatch[2]}`
}

export function matchesWallpaperTypeFilter(type: WallpaperType, filterType: WallpaperFilterType[]): boolean {
  const selectedTypes = filterType.filter((value): value is WallpaperType => value !== 'all')

  if (selectedTypes.length === 0) {
    return true
  }

  return selectedTypes.includes(type)
}

export function buildRequiredTags(
  settings: Pick<AppSettings, 'filterTags' | 'filterAgeRating' | 'filterResolution'>,
  baseTags: string[] = []
): string[] {
  const customTags = settings.filterTags.map(tag => tag.trim()).filter(Boolean)
  const ageRatingTags = settings.filterAgeRating
    .map(value => AGE_RATINGS[value]?.workshopTag)
    .filter(Boolean)
  const resolutionTags = settings.filterResolution
    .map(value => toWorkshopResolutionTag(value))
    .filter((value): value is string => value != null)

  return Array.from(new Set([...baseTags, ...customTags, ...ageRatingTags, ...resolutionTags]))
}

export function shuffleDiscoverSectionConfigs(sectionConfigs: DiscoverSectionConfig[]): DiscoverSectionConfig[] {
  const shuffledConfigs = [...sectionConfigs]

  for (let index = shuffledConfigs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentConfig = shuffledConfigs[index]

    shuffledConfigs[index] = shuffledConfigs[swapIndex]
    shuffledConfigs[swapIndex] = currentConfig
  }

  return shuffledConfigs
}

type WorkshopSourceItem = {
  publishedFileId: bigint
  title: string
  owner: {
    steamId64: bigint
  }
  tags: string[]
  previewUrl?: string | null
}

export function mapWorkshopItems(
  items: Array<WorkshopSourceItem | null | undefined>,
  filterType: AppSettings['filterType']
): WorkshopItem[] {
  return items
    .filter((item): item is WorkshopSourceItem => item != null)
    .map((item): WorkshopItem => ({
      id: item.publishedFileId.toString(),
      title: item.title,
      author: item.owner.steamId64.toString(),
      ageRating: parseWorkshopAgeRating(item.tags),
      type: parseWorkshopType(item.tags),
      tags: item.tags,
      previewUrl: item.previewUrl ?? undefined,
    }))
    .filter(item => matchesWallpaperTypeFilter(item.type, filterType))
}
