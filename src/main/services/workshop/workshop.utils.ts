import {
  AGE_RATING_VALUES,
  AGE_RATINGS,
  WALLPAPER_TYPE_OPTIONS,
  type AgeRating,
  type Wallpaper,
  type WallpaperType,
} from '../../../shared/constants/wallpaper'
import type { AppSettings } from '../../../shared/constants/app'
import { FIRST_PAGE, WORKSHOP_RESOLUTION_OPTIONS } from '../../../shared/constants/workshop'
import type { DiscoverSectionConfig, WorkshopItem } from './workshop.types'

type WorkshopFilterSettings = Pick<
  AppSettings,
  | 'workshopFilterType'
  | 'workshopFilterAgeRating'
  | 'workshopFilterTags'
  | 'workshopFilterResolution'
>

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

export function parseWorkshopAgeRating(tags: string[]): AgeRating | undefined {
  const normalizedTags = new Set(tags.map((tag) => tag.trim().toLowerCase()))

  return AGE_RATING_VALUES.find((ageRating) =>
    normalizedTags.has(AGE_RATINGS[ageRating].workshopTag.toLowerCase()),
  )
}

export function parseWorkshopType(tags: string[]): WallpaperType {
  const normalizedTags = new Set(tags.map((tag) => tag.trim().toLowerCase()))

  return (
    WALLPAPER_TYPE_OPTIONS.find((option) => normalizedTags.has(option.label.toLowerCase()))
      ?.value ?? 'scene'
  )
}

export function parseWorkshopResolution(tags: string[]): Wallpaper['resolution'] {
  const normalizedTags = new Set(tags.map((tag) => tag.trim().toLowerCase()))
  const resolutionTag = WORKSHOP_RESOLUTION_OPTIONS.find((option) =>
    normalizedTags.has(option.label.toLowerCase()),
  )?.label
  const size = resolutionTag?.match(/(\d+) x (\d+)/)

  return {
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
    label: resolutionTag,
  }
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

/**
 * Builds the Steam tag sets to query for the current Workshop filters. Each set is one query, and the
 * union of all queries is the result.
 *
 * Tags split into two classes:
 * - "always required": `baseTags`, included in every set (for example a Discover section's tag).
 * - "axes": categories where the user may pick several values (type, age rating, tags, resolution).
 *   The axes are Cartesian-producted so each query is a pure AND (matchAnyTag=false) and the union
 *   gives OR-within-category. Resolution must be an axis: a wallpaper carries one resolution tag, so
 *   requiring two of them at once matches nothing. Tags are an axis for the same reason in practice:
 *   genre tags rarely overlap, so requiring several of them mostly returns nothing.
 *
 * The number of sets is the product of the selected values per axis, and each set is one Steam query
 * per page.
 *
 * @param settings - The persisted Workshop filter settings.
 * @param baseTags - Tags every returned set must include.
 * @returns One tag list per Steam query; a single empty list when nothing is selected.
 */
export function buildFilterCombinations(
  settings: WorkshopFilterSettings,
  baseTags: string[] = [],
): string[][] {
  const customTags = Array.from(
    new Set(settings.workshopFilterTags.map((tag) => tag.trim()).filter(Boolean)),
  )
  const resolutionTags = Array.from(
    new Set(
      settings.workshopFilterResolution
        .map((value) => toWorkshopResolutionTag(value))
        .filter((value): value is string => value != null),
    ),
  )
  const alwaysRequired = Array.from(new Set(baseTags))

  const typeTags = settings.workshopFilterType.flatMap((type) =>
    WALLPAPER_TYPE_OPTIONS.filter((option) => option.value === type).map((option) => option.label),
  )
  const ageRatingTags = settings.workshopFilterAgeRating.map(
    (rating) => AGE_RATINGS[rating].workshopTag,
  )

  // Placeholder axis keeps a singleton combination when a category has no selection.
  const axes: Array<Array<string | null>> = [
    typeTags.length > 0 ? typeTags : [null],
    ageRatingTags.length > 0 ? ageRatingTags : [null],
    customTags.length > 0 ? customTags : [null],
    resolutionTags.length > 0 ? resolutionTags : [null],
  ]

  let combinations: Array<Array<string | null>> = [[]]
  for (const axis of axes) {
    combinations = combinations.flatMap((prefix) => axis.map((value) => [...prefix, value]))
  }

  return combinations.map((combo) => {
    const comboTags = combo.filter((tag): tag is string => typeof tag === 'string')
    return Array.from(new Set([...alwaysRequired, ...comboTags]))
  })
}

export function shuffleDiscoverSectionConfigs(
  sectionConfigs: DiscoverSectionConfig[],
): DiscoverSectionConfig[] {
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
  limit?: number,
): T[] {
  const mergedItems: T[] = []
  const seenIds = new Set<string>()
  const normalizedGroups = itemGroups.map((group) =>
    group.filter((item): item is T => item != null),
  )
  const maxGroupLength = normalizedGroups.reduce(
    (currentMax, group) => Math.max(currentMax, group.length),
    0,
  )

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

export type WorkshopPaginatedResultLike<TItem> = {
  items: Array<TItem | null | undefined>
  returnedResults: number
  totalResults: number
  wasCached: boolean
}

function isInvalidWorkshopPageError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()
  return normalizedMessage.includes('parameter') && normalizedMessage.includes('invalid')
}

export async function settleWorkshopPageResults<TItem>(
  requests: Array<Promise<WorkshopPaginatedResultLike<TItem>>>,
  page: number,
): Promise<WorkshopPaginatedResultLike<TItem>[]> {
  const settledResults = await Promise.allSettled(requests)
  const results: WorkshopPaginatedResultLike<TItem>[] = []
  let firstError: unknown = null

  for (const settledResult of settledResults) {
    if (settledResult.status === 'fulfilled') {
      results.push(settledResult.value)
      continue
    }

    if (page > FIRST_PAGE && isInvalidWorkshopPageError(settledResult.reason)) {
      results.push({
        items: [],
        returnedResults: 0,
        totalResults: 0,
        wasCached: false,
      })
      continue
    }

    if (firstError == null) {
      firstError = settledResult.reason
    }
  }

  if (results.length > 0) {
    return results
  }

  throw firstError
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
export function mapWorkshopItems(
  items: Array<WorkshopSourceItem | null | undefined>,
): WorkshopItem[] {
  return items
    .filter((item): item is WorkshopSourceItem => item != null)
    .map((item): WorkshopItem => ({
      id: item.publishedFileId.toString(),
      title: item.title,
      author: item.owner.steamId64.toString(),
      ageRating: parseWorkshopAgeRating(item.tags),
      type: parseWorkshopType(item.tags),
      resolution: parseWorkshopResolution(item.tags),
      tags: item.tags,
      previewUrl: item.previewUrl ?? undefined,
    }))
}
