import { AGE_RATINGS, FILTER_TYPE_OPTIONS, type AgeRating, type WallpaperType } from '../../../shared/constants/wallpaper'
import type { AppSettings } from '../../../shared/constants/app'
import type { DiscoverSectionConfig, WorkshopItem } from './workshop.types'

type WorkshopFilterSettings = Pick<AppSettings, 'workshopFilterType' | 'workshopFilterAgeRating' | 'workshopFilterTags' | 'workshopFilterResolution'>

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

// All filters we want Steam to honor, split into two classes:
//  - "always required": tags every combination must include (custom tags, resolution, any caller-supplied base tags).
//  - "axes": categories where the user may pick multiple values (type, age rating). We Cartesian-product the axes
//    so each sub-query is a pure AND (matchAnyTag=false), and the union of sub-queries gives OR-within-category.
export function buildFilterCombinations(
  settings: WorkshopFilterSettings,
  baseTags: string[] = []
): string[][] {
  const customTags = settings.workshopFilterTags.map(tag => tag.trim()).filter(Boolean)
  const resolutionTags = settings.workshopFilterResolution
    .map(value => toWorkshopResolutionTag(value))
    .filter((value): value is string => value != null)
  const alwaysRequired = Array.from(new Set([...baseTags, ...customTags, ...resolutionTags]))

  const typeTags = settings.workshopFilterType
    .filter((value): value is WallpaperType => value !== 'all')
    .map(type => WORKSHOP_TYPE_TAGS[type])
  const ageRatingTags = settings.workshopFilterAgeRating.map(rating => AGE_RATINGS[rating].workshopTag)

  // Placeholder axis keeps a singleton combination when a category has no selection.
  const axes: Array<Array<string | null>> = [
    typeTags.length > 0 ? typeTags : [null],
    ageRatingTags.length > 0 ? ageRatingTags : [null],
  ]

  let combinations: Array<Array<string | null>> = [[]]
  for (const axis of axes) {
    combinations = combinations.flatMap(prefix => axis.map(value => [...prefix, value]))
  }

  return combinations.map(combo => {
    const comboTags = combo.filter((tag): tag is string => typeof tag === 'string')
    return Array.from(new Set([...alwaysRequired, ...comboTags]))
  })
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

type WorkshopMergeableItem = {
  publishedFileId: bigint
}

export function mergeWorkshopItemsBySource<T extends WorkshopMergeableItem>(
  itemGroups: Array<Array<T | null | undefined>>,
  limit?: number
): T[] {
  const mergedItems: T[] = []
  const seenIds = new Set<string>()
  const normalizedGroups = itemGroups.map(group => group.filter((item): item is T => item != null))
  const maxGroupLength = normalizedGroups.reduce((currentMax, group) => Math.max(currentMax, group.length), 0)

  for (let itemIndex = 0; itemIndex < maxGroupLength; itemIndex += 1) {
    for (const group of normalizedGroups) {
      const item = group[itemIndex]

      if (!item) {
        continue
      }

      const itemId = item.publishedFileId.toString()
      if (seenIds.has(itemId)) {
        continue
      }

      seenIds.add(itemId)
      mergedItems.push(item)

      if (limit != null && mergedItems.length >= limit) {
        return mergedItems
      }
    }
  }

  return mergedItems
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

// Pure mapper — filtering is done server-side via requiredTags so every item reaching here is already in-scope.
export function mapWorkshopItems(items: Array<WorkshopSourceItem | null | undefined>): WorkshopItem[] {
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
}
