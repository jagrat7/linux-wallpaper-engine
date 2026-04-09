import { useCallback, useEffect, useMemo, type ReactNode } from "react"
import { useAtom, useSetAtom } from "jotai"
import { useDebounce } from "@uidotdev/usehooks"
import { trpc } from "@/lib/trpc"
import {
  availableResolutionsAtom,
  availableTagsAtom,
  filterAgeRatingAtom,
  filterCompatibilityAtom,
  filterResolutionAtom,
  filterTagsAtom,
  filterTypeAtom,
  searchQueryAtom,
  sortByAtom,
  sortOrderAtom,
} from "@/contexts/atoms/search-atoms"
import type { CompatibilityStatus } from "../../shared/constants/compatibility"
import type { AgeRating, WallpaperFilterType } from "../../shared/constants/wallpaper"
import type { SortBy, SortOrder } from "../../shared/constants/sort"

export type { AgeRating, WallpaperFilterType, SortBy, SortOrder }

interface SearchQueryContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

interface SortContextType {
  sortBy: SortBy
  setSortBy: (sort: SortBy) => void
  sortOrder: SortOrder
  setSortOrder: (order: SortOrder) => void
}

interface FilterContextType {
  filterType: WallpaperFilterType[]
  setFilterType: (types: WallpaperFilterType[]) => void
  toggleFilterType: (type: WallpaperFilterType) => void
  filterAgeRating: AgeRating[]
  setFilterAgeRating: (ratings: AgeRating[]) => void
  toggleFilterAgeRating: (rating: AgeRating) => void
  filterTags: string[]
  setFilterTags: (tags: string[]) => void
  toggleTag: (tag: string) => void
  availableTags: string[]
  setAvailableTags: (tags: string[]) => void
  filterResolution: string[]
  setFilterResolution: (resolutions: string[]) => void
  toggleResolution: (res: string) => void
  availableResolutions: string[]
  setAvailableResolutions: (resolutions: string[]) => void
  filterCompatibility: CompatibilityStatus[]
  setFilterCompatibility: (statuses: CompatibilityStatus[]) => void
  toggleFilterCompatibility: (status: CompatibilityStatus) => void
}

// --- Combined provider ---

export function SearchProvider({ children }: { children: ReactNode }) {
  const { data: settings } = trpc.settings.get.useQuery()

  const setFilterType = useSetAtom(filterTypeAtom)
  const setFilterAgeRating = useSetAtom(filterAgeRatingAtom)
  const setFilterTags = useSetAtom(filterTagsAtom)
  const setFilterResolution = useSetAtom(filterResolutionAtom)
  const setFilterCompatibility = useSetAtom(filterCompatibilityAtom)
  const setSortBy = useSetAtom(sortByAtom)
  const setSortOrder = useSetAtom(sortOrderAtom)

  // Load persisted preferences on mount
  useEffect(() => {
    if (settings) {
      setFilterType(settings.filterType ?? [])
      setFilterAgeRating(settings.filterAgeRating ?? [])
      setFilterTags(settings.filterTags)
      setFilterResolution(settings.filterResolution)
      setFilterCompatibility(settings.filterCompatibility)
      setSortBy(settings.sortBy)
      setSortOrder(settings.sortOrder)
    }
  }, [settings, setFilterAgeRating, setFilterCompatibility, setFilterResolution, setFilterTags, setFilterType, setSortBy, setSortOrder])

  return children
}

// --- Hooks ---

export function useSearchQuery() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)

  return useMemo<SearchQueryContextType>(() => ({
    searchQuery,
    setSearchQuery,
  }), [searchQuery, setSearchQuery])
}

export function useSort() {
  const [sortBy, setSortByValue] = useAtom(sortByAtom)
  const [sortOrder, setSortOrderValue] = useAtom(sortOrderAtom)
  const updateSettings = trpc.settings.update.useMutation()

  const setSortBy = useCallback((sort: SortBy) => {
    setSortByValue(sort)
    updateSettings.mutate({ sortBy: sort })
  }, [setSortByValue, updateSettings])

  const setSortOrder = useCallback((order: SortOrder) => {
    setSortOrderValue(order)
    updateSettings.mutate({ sortOrder: order })
  }, [setSortOrderValue, updateSettings])

  return useMemo<SortContextType>(() => ({
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
  }), [sortBy, setSortBy, sortOrder, setSortOrder])
}

export function useFilter() {
  const [filterType, setFilterTypeValue] = useAtom(filterTypeAtom)
  const [filterAgeRating, setFilterAgeRatingValue] = useAtom(filterAgeRatingAtom)
  const [filterTags, setFilterTagsValue] = useAtom(filterTagsAtom)
  const [availableTags, setAvailableTags] = useAtom(availableTagsAtom)
  const [filterResolution, setFilterResolutionValue] = useAtom(filterResolutionAtom)
  const [availableResolutions, setAvailableResolutions] = useAtom(availableResolutionsAtom)
  const [filterCompatibility, setFilterCompatibilityValue] = useAtom(filterCompatibilityAtom)
  const updateSettings = trpc.settings.update.useMutation()

  const setFilterType = useCallback((types: WallpaperFilterType[]) => {
    setFilterTypeValue(types)
    updateSettings.mutate({ filterType: types })
  }, [setFilterTypeValue, updateSettings])

  const toggleFilterType = useCallback((type: WallpaperFilterType) => {
    setFilterTypeValue(prev => {
      const next = prev.includes(type)
        ? prev.filter(item => item !== type)
        : [...prev, type]
      updateSettings.mutate({ filterType: next })
      return next
    })
  }, [setFilterTypeValue, updateSettings])

  const setFilterAgeRating = useCallback((ratings: AgeRating[]) => {
    setFilterAgeRatingValue(ratings)
    updateSettings.mutate({ filterAgeRating: ratings })
  }, [setFilterAgeRatingValue, updateSettings])

  const toggleFilterAgeRating = useCallback((rating: AgeRating) => {
    setFilterAgeRatingValue(prev => {
      const next = prev.includes(rating)
        ? prev.filter(item => item !== rating)
        : [...prev, rating]
      updateSettings.mutate({ filterAgeRating: next })
      return next
    })
  }, [setFilterAgeRatingValue, updateSettings])

  const setFilterTags = useCallback((tags: string[]) => {
    setFilterTagsValue(tags)
    updateSettings.mutate({ filterTags: tags })
  }, [setFilterTagsValue, updateSettings])

  const toggleTag = useCallback((tag: string) => {
    setFilterTagsValue(prev => {
      const next = prev.includes(tag)
        ? prev.filter(item => item !== tag)
        : [...prev, tag]
      updateSettings.mutate({ filterTags: next })
      return next
    })
  }, [setFilterTagsValue, updateSettings])

  const setFilterResolution = useCallback((resolutions: string[]) => {
    setFilterResolutionValue(resolutions)
    updateSettings.mutate({ filterResolution: resolutions })
  }, [setFilterResolutionValue, updateSettings])

  const toggleResolution = useCallback((resolution: string) => {
    setFilterResolutionValue(prev => {
      const next = prev.includes(resolution)
        ? prev.filter(item => item !== resolution)
        : [...prev, resolution]
      updateSettings.mutate({ filterResolution: next })
      return next
    })
  }, [setFilterResolutionValue, updateSettings])

  const setFilterCompatibility = useCallback((statuses: CompatibilityStatus[]) => {
    setFilterCompatibilityValue(statuses)
    updateSettings.mutate({ filterCompatibility: statuses })
  }, [setFilterCompatibilityValue, updateSettings])

  const toggleFilterCompatibility = useCallback((status: CompatibilityStatus) => {
    setFilterCompatibilityValue(prev => {
      const next = prev.includes(status)
        ? prev.filter(item => item !== status)
        : [...prev, status]
      updateSettings.mutate({ filterCompatibility: next })
      return next
    })
  }, [setFilterCompatibilityValue, updateSettings])

  return useMemo<FilterContextType>(() => ({
    filterType,
    setFilterType,
    toggleFilterType,
    filterAgeRating,
    setFilterAgeRating,
    toggleFilterAgeRating,
    filterTags,
    setFilterTags,
    toggleTag,
    availableTags,
    setAvailableTags,
    filterResolution,
    setFilterResolution,
    toggleResolution,
    availableResolutions,
    setAvailableResolutions,
    filterCompatibility,
    setFilterCompatibility,
    toggleFilterCompatibility,
  }), [
    availableResolutions,
    availableTags,
    filterAgeRating,
    filterCompatibility,
    filterResolution,
    filterTags,
    filterType,
    setFilterAgeRating,
    setAvailableResolutions,
    setAvailableTags,
    setFilterCompatibility,
    setFilterResolution,
    setFilterTags,
    setFilterType,
    toggleFilterAgeRating,
    toggleFilterCompatibility,
    toggleResolution,
    toggleTag,
    toggleFilterType,
  ])
}

// Convenience hook that combines all three (for WallpaperGrid)
export function useSearch() {
  return {
    ...useSearchQuery(),
    ...useSort(),
    ...useFilter(),
  }
}

// Hook that provides debounced search query
export function useDebouncedSearchQuery(delay = 300) {
  const { searchQuery, setSearchQuery } = useSearchQuery()
  const debouncedSearchQuery = useDebounce(searchQuery, delay)
  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
  }
}

