import { trpc } from "@/lib/trpc"
import { useMemo } from "react"
import type { AgeRating, Wallpaper, WallpaperFilterType } from "../../shared/constants/wallpaper"
import type { CompatibilityStatus } from "../../shared/constants/compatibility"
import type { SortBy, SortOrder } from "../../shared/constants/sort"

export interface FilterSortOptions {
    searchQuery: string
    filterType: WallpaperFilterType[]
    filterAgeRating: AgeRating[]
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
    const { searchQuery, filterType, filterAgeRating, filterTags, filterResolution, filterCompatibility, sortBy, sortOrder, compatibilityMap } = options
    let result = [...wallpapers]

    const normalizedSearchQuery = searchQuery.trim().toLowerCase()
    const hasSearchQuery = normalizedSearchQuery.length > 0
    const hasTypeFilter = filterType.length > 0
    const typeSet = hasTypeFilter ? new Set(filterType) : null
    const hasAgeRatingFilter = filterAgeRating.length > 0
    const ageRatingSet = hasAgeRatingFilter ? new Set(filterAgeRating) : null
    const hasTagFilter = filterTags.length > 0
    const hasResolutionFilter = filterResolution.length > 0
    const hasCompatFilter = filterCompatibility.length > 0 && compatibilityMap
    const compatSet = hasCompatFilter ? new Set(filterCompatibility) : null

    if (hasSearchQuery || hasTypeFilter || hasAgeRatingFilter || hasTagFilter || hasCompatFilter || hasResolutionFilter) {
        result = result.filter(w => {
            if (hasSearchQuery) {
                const matchesSearch =
                    w.title.toLowerCase().includes(normalizedSearchQuery) ||
                    w.author.toLowerCase().includes(normalizedSearchQuery) ||
                    w.tags.some(tag => tag.toLowerCase().includes(normalizedSearchQuery))

                if (!matchesSearch) return false
            }

            if (typeSet && !typeSet.has(w.type)) return false
            if (ageRatingSet && w.ageRating && !ageRatingSet.has(w.ageRating)) return false
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
            case "recent": {
                // Same asc/desc convention as "date"; never-applied wallpapers fall back to
                // install date so they stay meaningfully ordered
                const aApplied = a.lastAppliedAt ?? 0
                const bApplied = b.lastAppliedAt ?? 0
                comparison = bApplied === aApplied ? a.dateAdded - b.dateAdded : aApplied - bApplied
                break
            }
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
 * Fetches installed wallpapers and related metadata.
 */
export function useWallpapers() {
    const {
        data,
        isLoading,
        isFetching,
        error,
        refetch,
    } = trpc.wallpaper.getWallpapers.useQuery()

    const invalidateCache = trpc.wallpaper.invalidateCache.useMutation()
    const { data: compatibilityMap } = trpc.wallpaper.getCompatibilityMap.useQuery()
    const { data: appSettings } = trpc.settings.get.useQuery()
    const rawWallpapers = data?.wallpapers
    const appliedHistory = data?.appliedHistory

    const wallpapers: Wallpaper[] = useMemo(() => {
        if (!rawWallpapers) return []

        return rawWallpapers.map((w) => ({
            id: w.id,
            workshopId: w.workshopId,
            title: w.title,
            author: w.author,
            ageRating: w.ageRating,
            type: w.type,
            thumbnail: w.thumbnail ? `local-file://${w.thumbnail}` : "",
            previewUrl: w.previewUrl ? `local-file://${w.previewUrl}` : undefined,
            resolution: w.resolution,
            fileSize: w.fileSize,
            dateAdded: w.dateAdded,
            tags: w.tags,
            installed: w.installed,
            path: w.path,
            lastAppliedAt: appliedHistory?.[w.path],
        }))
    }, [rawWallpapers, appliedHistory])

    const hardRefresh = async () => {
        await invalidateCache.mutateAsync()
        return refetch()
    }

    return {
        /** Raw data from tRPC (before transformation), useful for extracting tags/resolutions */
        rawWallpapers,
        /** Transformed wallpapers with local-file:// prefixed thumbnails */
        wallpapers,
        isLoading,
        isFetching,
        error,
        refetch: hardRefresh,
        compatibilityMap,
        appSettings,
    }
}
