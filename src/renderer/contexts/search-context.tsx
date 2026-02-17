import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import type {
  CompatibilityStatus,
  WallpaperFilterType,
  SortBy,
  SortOrder,
} from "../../shared/constants"

export type { WallpaperFilterType, SortBy, SortOrder }
// TODO: - Convert to a hook, provider is not longer needed
// --- Search query context (search input only) ---

interface SearchQueryContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

const SearchQueryContext = createContext<SearchQueryContextType | undefined>(undefined)

// --- Sort context ---

interface SortContextType {
  sortBy: SortBy
  setSortBy: (sort: SortBy) => void
  sortOrder: SortOrder
  setSortOrder: (order: SortOrder) => void
}

const SortContext = createContext<SortContextType | undefined>(undefined)

// --- Filter context ---

interface FilterContextType {
  filterType: WallpaperFilterType[]
  setFilterType: (types: WallpaperFilterType[]) => void
  toggleFilterType: (type: WallpaperFilterType) => void
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

const FilterContext = createContext<FilterContextType | undefined>(undefined)

// --- Combined provider ---

export function SearchProvider({ children }: { children: ReactNode }) {
  const { data: settings } = trpc.settings.get.useQuery()
  const updateSettings = trpc.settings.update.useMutation()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<WallpaperFilterType[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [filterResolution, setFilterResolution] = useState<string[]>([])
  const [availableResolutions, setAvailableResolutions] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [filterCompatibility, setFilterCompatibility] = useState<CompatibilityStatus[]>([])
  const [initialized, setInitialized] = useState(false)

  // Load persisted preferences on mount
  useEffect(() => {
    if (settings && !initialized) {
      setFilterType(settings.filterType ?? [])
      setFilterTags(settings.filterTags)
      setFilterResolution(settings.filterResolution)
      setFilterCompatibility(settings.filterCompatibility)
      setSortBy(settings.sortBy)
      setSortOrder(settings.sortOrder)
      setInitialized(true)
    }
  }, [settings, initialized])

  // Persist filter/sort changes
  const persist = useCallback((partial: Record<string, unknown>) => {
    updateSettings.mutate(partial)
  }, [updateSettings])

  // --- Search query handlers ---

  const searchQueryValue = useMemo(() => ({
    searchQuery,
    setSearchQuery,
  }), [searchQuery])

  // --- Sort handlers ---

  const handleSetSortBy = useCallback((sort: SortBy) => {
    setSortBy(sort)
    persist({ sortBy: sort })
  }, [persist])

  const handleSetSortOrder = useCallback((order: SortOrder) => {
    setSortOrder(order)
    persist({ sortOrder: order })
  }, [persist])

  const sortValue = useMemo(() => ({
    sortBy,
    setSortBy: handleSetSortBy,
    sortOrder,
    setSortOrder: handleSetSortOrder,
  }), [sortBy, sortOrder, handleSetSortBy, handleSetSortOrder])

  // --- Filter handlers ---

  const handleSetFilterType = useCallback((types: WallpaperFilterType[]) => {
    setFilterType(types)
    persist({ filterType: types })
  }, [persist])

  const handleToggleFilterType = useCallback((type: WallpaperFilterType) => {
    setFilterType(prev => {
      const next = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
      persist({ filterType: next })
      return next
    })
  }, [persist])

  const handleSetFilterTags = useCallback((tags: string[]) => {
    setFilterTags(tags)
    persist({ filterTags: tags })
  }, [persist])

  const handleToggleTag = useCallback((tag: string) => {
    setFilterTags(prev => {
      const next = prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
      persist({ filterTags: next })
      return next
    })
  }, [persist])

  const handleSetFilterResolution = useCallback((resolutions: string[]) => {
    setFilterResolution(resolutions)
    persist({ filterResolution: resolutions })
  }, [persist])

  const handleToggleResolution = useCallback((res: string) => {
    setFilterResolution(prev => {
      const next = prev.includes(res)
        ? prev.filter(r => r !== res)
        : [...prev, res]
      persist({ filterResolution: next })
      return next
    })
    
  }, [persist])

  const handleSetFilterCompatibility = useCallback((statuses: CompatibilityStatus[]) => {
    setFilterCompatibility(statuses)
    persist({ filterCompatibility: statuses })
  }, [persist])

  const handleToggleFilterCompatibility = useCallback((status: CompatibilityStatus) => {
    setFilterCompatibility(prev => {
      const next = prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
      persist({ filterCompatibility: next })
      return next
    })
  }, [persist])

  const filterValue = useMemo(() => ({
    filterType,
    setFilterType: handleSetFilterType,
    toggleFilterType: handleToggleFilterType,
    filterTags,
    setFilterTags: handleSetFilterTags,
    toggleTag: handleToggleTag,
    availableTags,
    setAvailableTags,
    filterResolution,
    setFilterResolution: handleSetFilterResolution,
    toggleResolution: handleToggleResolution,
    availableResolutions,
    setAvailableResolutions,
    filterCompatibility,
    setFilterCompatibility: handleSetFilterCompatibility,
    toggleFilterCompatibility: handleToggleFilterCompatibility,
  }), [filterType, filterTags,filterResolution, availableTags,availableResolutions,filterResolution, filterCompatibility, handleSetFilterType, handleToggleFilterType, handleSetFilterTags,handleSetFilterResolution, handleToggleTag,handleToggleResolution, handleSetFilterCompatibility, handleToggleFilterCompatibility])

  
  return (
    <SearchQueryContext.Provider value={searchQueryValue}>
      <SortContext.Provider value={sortValue}>
        <FilterContext.Provider value={filterValue}>
          {children}
        </FilterContext.Provider>
      </SortContext.Provider>
    </SearchQueryContext.Provider>
  )
}

// --- Hooks ---

export function useSearchQuery() {
  const context = useContext(SearchQueryContext)
  if (!context) {
    throw new Error("useSearchQuery must be used within SearchProvider")
  }
  return context
}

export function useSort() {
  const context = useContext(SortContext)
  if (!context) {
    throw new Error("useSort must be used within SearchProvider")
  }
  return context
}

export function useFilter() {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error("useFilter must be used within SearchProvider")
  }
  return context
}

// Convenience hook that combines all three (for WallpaperGrid)
export function useSearch() {
  return {
    ...useSearchQuery(),
    ...useSort(),
    ...useFilter(),
  }
}

