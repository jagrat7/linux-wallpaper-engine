import { useCallback, useEffect, useMemo, type ReactNode } from "react"
import { useAtom, useSetAtom } from "jotai"
import { useDebounce } from "@uidotdev/usehooks"
import { trpc } from "@/lib/trpc"
import {
  workshopFilterAgeRatingAtom,
  workshopFilterResolutionAtom,
  workshopFilterTagsAtom,
  workshopFilterTypeAtom,
  workshopSearchQueryAtom,
  workshopSortByAtom,
} from "@/contexts/atoms/workshop-atoms"
import type { AgeRating, WallpaperFilterType } from "../../shared/constants/wallpaper"
import type { WorkshopSortBy } from "../../shared/constants/workshop"

export type { AgeRating, WallpaperFilterType, WorkshopSortBy }

interface WorkshopSearchQueryContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

interface WorkshopSortContextType {
  sortBy: WorkshopSortBy
  setSortBy: (sort: WorkshopSortBy) => void
}

interface WorkshopFilterContextType {
  filterType: WallpaperFilterType[]
  setFilterType: (types: WallpaperFilterType[]) => void
  toggleFilterType: (type: WallpaperFilterType) => void
  filterAgeRating: AgeRating[]
  setFilterAgeRating: (ratings: AgeRating[]) => void
  toggleFilterAgeRating: (rating: AgeRating) => void
  filterTags: string[]
  setFilterTags: (tags: string[]) => void
  toggleTag: (tag: string) => void
  filterResolution: string[]
  setFilterResolution: (resolutions: string[]) => void
  toggleResolution: (res: string) => void
}

export function WorkshopSearchProvider({ children }: { children: ReactNode }) {
  const { data: settings } = trpc.settings.get.useQuery()

  const setFilterType = useSetAtom(workshopFilterTypeAtom)
  const setFilterAgeRating = useSetAtom(workshopFilterAgeRatingAtom)
  const setFilterTags = useSetAtom(workshopFilterTagsAtom)
  const setFilterResolution = useSetAtom(workshopFilterResolutionAtom)
  const setWorkshopSortBy = useSetAtom(workshopSortByAtom)

  useEffect(() => {
    if (settings) {
      setFilterType(settings.workshopFilterType ?? [])
      setFilterAgeRating(settings.workshopFilterAgeRating ?? [])
      setFilterTags(settings.workshopFilterTags)
      setFilterResolution(settings.workshopFilterResolution)
      setWorkshopSortBy(settings.workshopSortBy)
    }
  }, [settings, setFilterAgeRating, setFilterResolution, setFilterTags, setFilterType, setWorkshopSortBy])

  return children
}

export function useWorkshopSearchQuery() {
  const [searchQuery, setSearchQuery] = useAtom(workshopSearchQueryAtom)

  return useMemo<WorkshopSearchQueryContextType>(() => ({
    searchQuery,
    setSearchQuery,
  }), [searchQuery, setSearchQuery])
}

export function useWorkshopSort() {
  const [sortBy, setSortByValue] = useAtom(workshopSortByAtom)
  const updateSettings = trpc.settings.update.useMutation()

  const setSortBy = useCallback((sort: WorkshopSortBy) => {
    setSortByValue(sort)
    updateSettings.mutate({ workshopSortBy: sort })
  }, [setSortByValue, updateSettings])

  return useMemo<WorkshopSortContextType>(() => ({
    sortBy,
    setSortBy,
  }), [sortBy, setSortBy])
}

export function useWorkshopFilter() {
  const [filterType, setFilterTypeValue] = useAtom(workshopFilterTypeAtom)
  const [filterAgeRating, setFilterAgeRatingValue] = useAtom(workshopFilterAgeRatingAtom)
  const [filterTags, setFilterTagsValue] = useAtom(workshopFilterTagsAtom)
  const [filterResolution, setFilterResolutionValue] = useAtom(workshopFilterResolutionAtom)
  const updateSettings = trpc.settings.update.useMutation()
  const utils = trpc.useUtils()

  const persistWorkshopFilterSettings = useCallback((input: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(input, {
      onSuccess: () => {
        void utils.workshop.getItems.invalidate()
        void utils.workshop.discover.invalidate()
      },
    })
  }, [updateSettings, utils])

  const setFilterType = useCallback((types: WallpaperFilterType[]) => {
    setFilterTypeValue(types)
    persistWorkshopFilterSettings({ workshopFilterType: types })
  }, [persistWorkshopFilterSettings, setFilterTypeValue])

  const toggleFilterType = useCallback((type: WallpaperFilterType) => {
    setFilterTypeValue(prev => {
      const next = prev.includes(type)
        ? prev.filter(item => item !== type)
        : [...prev, type]
      persistWorkshopFilterSettings({ workshopFilterType: next })
      return next
    })
  }, [persistWorkshopFilterSettings, setFilterTypeValue])

  const setFilterAgeRating = useCallback((ratings: AgeRating[]) => {
    setFilterAgeRatingValue(ratings)
    persistWorkshopFilterSettings({ workshopFilterAgeRating: ratings })
  }, [persistWorkshopFilterSettings, setFilterAgeRatingValue])

  const toggleFilterAgeRating = useCallback((rating: AgeRating) => {
    setFilterAgeRatingValue(prev => {
      const next = prev.includes(rating)
        ? prev.filter(item => item !== rating)
        : [...prev, rating]
      persistWorkshopFilterSettings({ workshopFilterAgeRating: next })
      return next
    })
  }, [persistWorkshopFilterSettings, setFilterAgeRatingValue])

  const setFilterTags = useCallback((tags: string[]) => {
    setFilterTagsValue(tags)
    persistWorkshopFilterSettings({ workshopFilterTags: tags })
  }, [persistWorkshopFilterSettings, setFilterTagsValue])

  const toggleTag = useCallback((tag: string) => {
    setFilterTagsValue(prev => {
      const next = prev.includes(tag)
        ? prev.filter(item => item !== tag)
        : [...prev, tag]
      persistWorkshopFilterSettings({ workshopFilterTags: next })
      return next
    })
  }, [persistWorkshopFilterSettings, setFilterTagsValue])

  const setFilterResolution = useCallback((resolutions: string[]) => {
    setFilterResolutionValue(resolutions)
    persistWorkshopFilterSettings({ workshopFilterResolution: resolutions })
  }, [persistWorkshopFilterSettings, setFilterResolutionValue])

  const toggleResolution = useCallback((resolution: string) => {
    setFilterResolutionValue(prev => {
      const next = prev.includes(resolution)
        ? prev.filter(item => item !== resolution)
        : [...prev, resolution]
      persistWorkshopFilterSettings({ workshopFilterResolution: next })
      return next
    })
  }, [persistWorkshopFilterSettings, setFilterResolutionValue])

  return useMemo<WorkshopFilterContextType>(() => ({
    filterType,
    setFilterType,
    toggleFilterType,
    filterAgeRating,
    setFilterAgeRating,
    toggleFilterAgeRating,
    filterTags,
    setFilterTags,
    toggleTag,
    filterResolution,
    setFilterResolution,
    toggleResolution,
  }), [
    filterAgeRating,
    filterResolution,
    filterTags,
    filterType,
    setFilterAgeRating,
    setFilterResolution,
    setFilterTags,
    setFilterType,
    toggleFilterAgeRating,
    toggleResolution,
    toggleTag,
    toggleFilterType,
  ])
}

export function useWorkshopSearch() {
  return {
    ...useWorkshopSearchQuery(),
    ...useWorkshopSort(),
    ...useWorkshopFilter(),
  }
}

export function useDebouncedWorkshopSearchQuery(delay = 300) {
  const { searchQuery, setSearchQuery } = useWorkshopSearchQuery()
  const debouncedSearchQuery = useDebounce(searchQuery, delay)

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
  }
}
