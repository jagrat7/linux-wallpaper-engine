import { atom } from "jotai"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"
import { DEFAULT_SETTINGS } from "../../../shared/constants/app"
import type { AgeRating, WallpaperFilterType } from "../../../shared/constants/wallpaper"
import type { SortBy, SortOrder } from "../../../shared/constants/sort"

export const searchQueryAtom = atom("")
export const filterTypeAtom = atom<WallpaperFilterType[]>([...DEFAULT_SETTINGS.filterType])
export const filterAgeRatingAtom = atom<AgeRating[]>([...DEFAULT_SETTINGS.filterAgeRating])
export const filterTagsAtom = atom<string[]>([...DEFAULT_SETTINGS.filterTags])
export const availableTagsAtom = atom<string[]>([])
export const filterResolutionAtom = atom<string[]>([...DEFAULT_SETTINGS.filterResolution])
export const availableResolutionsAtom = atom<string[]>([])
export const sortByAtom = atom<SortBy>(DEFAULT_SETTINGS.sortBy)
export const sortOrderAtom = atom<SortOrder>(DEFAULT_SETTINGS.sortOrder)
export const filterCompatibilityAtom = atom<CompatibilityStatus[]>([...DEFAULT_SETTINGS.filterCompatibility])
