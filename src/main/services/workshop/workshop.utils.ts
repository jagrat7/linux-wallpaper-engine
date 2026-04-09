import { AGE_RATINGS, FILTER_TYPE_OPTIONS, type AgeRating, type WallpaperFilterType, type WallpaperType } from '../../../shared/constants/wallpaper'

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
