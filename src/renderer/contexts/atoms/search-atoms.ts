import { atom } from "jotai"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"
import type { AgeRating, WallpaperFilterType } from "../../../shared/constants/wallpaper"
import type { SortBy, SortOrder } from "../../../shared/constants/sort"

export const searchQueryAtom = atom("")
export const filterTypeAtom = atom<WallpaperFilterType[]>([])
export const filterAgeRatingAtom = atom<AgeRating[]>([])
export const filterTagsAtom = atom<string[]>([])
export const availableTagsAtom = atom<string[]>([])
export const filterResolutionAtom = atom<string[]>([])
export const availableResolutionsAtom = atom<string[]>([])
export const sortByAtom = atom<SortBy>("name")
export const sortOrderAtom = atom<SortOrder>("asc")
export const filterCompatibilityAtom = atom<CompatibilityStatus[]>([])
