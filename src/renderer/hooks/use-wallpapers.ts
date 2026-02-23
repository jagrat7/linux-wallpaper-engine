import { trpc } from "@/lib/trpc"
import { useDebouncedSearchQuery } from "@/contexts/search-context"
import { useMemo } from "react"
import type { Wallpaper, CompatibilityStatus, WallpaperFilterType, SortBy, SortOrder } from "../../shared/constants"

export interface FilterSortOptions {
    filterType: WallpaperFilterType[]
    filterTags: string[]
    filterResolution: string[]
    filterCompatibility: CompatibilityStatus[]
    sortBy: SortBy
    sortOrder: SortOrder
    compatibilityMap?: Record<string, CompatibilityStatus>
}

/**
 * Pure utility to filter and sort wallpapers based on search context values.
 * Used by both WallpaperGrid and PlaylistEditorGrid.
 */
export function filterAndSortWallpapers(
    wallpapers: Wallpaper[],
    options: FilterSortOptions,
): Wallpaper[] {
    const { filterType, filterTags, filterResolution, filterCompatibility, sortBy, sortOrder, compatibilityMap } = options
    let result = [...wallpapers]

    const hasTypeFilter = filterType.length > 0
    const typeSet = hasTypeFilter ? new Set(filterType) : null
    const hasTagFilter = filterTags.length > 0
    const hasResolutionFilter = filterResolution.length > 0
    const hasCompatFilter = filterCompatibility.length > 0 && compatibilityMap
    const compatSet = hasCompatFilter ? new Set(filterCompatibility) : null

    if (hasTypeFilter || hasTagFilter || hasCompatFilter || hasResolutionFilter) {
        result = result.filter(w => {
            if (typeSet && !typeSet.has(w.type)) return false
            if (hasTagFilter && !filterTags.some(tag => w.tags?.includes(tag))) return false
            if (hasResolutionFilter && !filterResolution.includes(!w.resolution.height || !w.resolution.width ? "Unknown" : `${w.resolution.width}x${w.resolution.height}`)) return false

            if (compatSet && compatibilityMap) {
                const status = compatibilityMap[w.path ?? ''] ?? 'unknown'
                if (!compatSet.has(status)) return false
            }
            return true
        })
    }

    result.sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
            case "name":
                comparison = a.title.localeCompare(b.title)
                break
            case "size":
                comparison = a.fileSize - b.fileSize
                break
            case "recent":
                comparison = b.id.localeCompare(a.id)
                break
            case "date":
                comparison = a.dateAdded - b.dateAdded
                break
        }
        return sortOrder === "asc" ? comparison : -comparison
    })

    return result
}

/**
 * Shared hook that fetches wallpapers, compatibility map, and app settings.
 * Handles the raw-to-Wallpaper transformation with local-file:// prefixed thumbnails.
 * Debounces the search query internally so consumers don't need to.
 */
export function useWallpapers() {
    const { debouncedSearchQuery } = useDebouncedSearchQuery()

    const {
        data: rawWallpapers,
        isLoading,
        error,
        refetch,
    } = trpc.wallpaper.getWallpapers.useQuery({
        search: debouncedSearchQuery || undefined,
    })

    const { data: compatibilityMap } = trpc.wallpaper.getCompatibilityMap.useQuery()
    const { data: appSettings } = trpc.settings.get.useQuery()

    const wallpapers: Wallpaper[] = useMemo(() => {
        if (!rawWallpapers) return []

        return rawWallpapers.map((w) => ({
            id: w.id,
            workshopId: w.workshopId,
            title: w.title,
            author: w.author,
            type: w.type,
            thumbnail: w.thumbnail ? `local-file://${w.thumbnail}` : "",
            previewUrl: w.previewUrl ? `local-file://${w.previewUrl}` : undefined,
            resolution: w.resolution,
            fileSize: w.fileSize,
            dateAdded: w.dateAdded,
            tags: w.tags,
            installed: w.installed,
            path: w.path,
        }))
    }, [rawWallpapers])

    return {
        /** Raw data from tRPC (before transformation), useful for extracting tags/resolutions */
        rawWallpapers,
        /** Transformed wallpapers with local-file:// prefixed thumbnails */
        wallpapers,
        isLoading,
        error,
        refetch,
        compatibilityMap,
        appSettings,
    }
}
