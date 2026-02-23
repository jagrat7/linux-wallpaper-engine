import { motion, AnimatePresence } from "framer-motion"
import { WallpaperCard, type Wallpaper } from "./wallpaper-card"
import { GridHeader } from "./wallpaper-grid-header"
import { trpc } from "@/lib/trpc"
import { AlertCircle, FolderOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@uidotdev/usehooks"
import { useSearch } from "@/contexts/search-context"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react"

const WallpaperDetails = lazy(() => import("./wallpaper-details").then(m => ({ default: m.WallpaperDetails })))

// TODO: Fix wallpaper details size so that is consistent width with a column
export function WallpaperGrid() {
    const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null)
    const [detailsVisible, setDetailsVisible] = useState(false)
    const { searchQuery, filterType, filterTags, filterResolution, sortBy, sortOrder, setAvailableTags, setAvailableResolutions, filterCompatibility } = useSearch()
    const debouncedSearch = useDebounce(searchQuery, 300)
    const { setSelectedUrl } = useWallpaperBackground()

    const { data: compatibilityMap } = trpc.wallpaper.getCompatibilityMap.useQuery()
    const { data: settings } = trpc.settings.get.useQuery()

    // Throttle wallpaper selection to prevent UI freezing from rapid clicks
    const lastClickTime = useRef(0)
    const THROTTLE_MS = 150

    const {
        data,
        isLoading,
        error,
        refetch,
    } = trpc.wallpaper.getWallpapers.useQuery({
        search: debouncedSearch || undefined,
    })

    // Transform, filter and sort wallpapers
    const wallpapers: Wallpaper[] = useMemo(() => {
        if (!data) return []

        let result = data.map((w) => ({
            id: w.id,
            workshopId: w.workshopId,
            title: w.title,
            author: w.author,
            type: w.type,
            thumbnail: w.thumbnail ? `local-file://${w.thumbnail}` : '',
            previewUrl: w.previewUrl ? `local-file://${w.previewUrl}` : undefined,
            resolution: w.resolution,
            fileSize: w.fileSize,
            dateAdded: w.dateAdded,
            tags: w.tags,
            installed: w.installed,
            path: w.path,
        }))

        // Apply all filters in a single pass
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

        // Apply sorting
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
    }, [data, filterType, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    // Sync selected wallpaper thumbnail as blurred page background
    useEffect(() => {
        setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
    }, [selectedWallpaper, setSelectedUrl])


    // Extract and set available tags from raw data (before filtering)
    useEffect(() => {
        if (!data) return

        const { tags, resolutions } = data.reduce((acc, item) => {

            item.tags && acc.tags.push(...item.tags);


            acc.resolutions.push(!item.resolution.height || !item.resolution.width ? "Unknown" : `${item.resolution.width}x${item.resolution.height}`);

            return acc;
        },
            {
                tags: [] as string[],
                resolutions: [] as string[],
            },
        );


        const uniqueTags = [...new Set(tags)].sort()
        const uniqueResolutions = [...new Set(resolutions)].sort((a, b) => {
            if (a === "Unknown") return -1
            if (b === "Unknown") return 1

            const [widthA, heightA] = a.split('x')
            const [widthB, heightB] = b.split('x')
            return parseInt(widthB) * parseInt(heightB) - parseInt(widthA) * parseInt(heightA)
        })
        setAvailableTags(uniqueTags)
        setAvailableResolutions(uniqueResolutions)

    }, [data, setAvailableTags, setAvailableResolutions])


    const toggleWallpaper = useCallback((w: Wallpaper) => {
        const now = Date.now()
        if (now - lastClickTime.current < THROTTLE_MS) {
            return // Ignore rapid clicks
        }
        lastClickTime.current = now
        setSelectedWallpaper(prev => prev?.id === w.id ? null : w)
    }, [])

    const handleRefresh = () => {
        refetch()
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col h-full">
                <GridHeader onRefresh={handleRefresh} isLoading={isLoading} />
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col h-full">
                <GridHeader onRefresh={handleRefresh} isLoading={isLoading} />
                <motion.div
                    className="flex flex-col items-center justify-center py-20 text-destructive"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                >
                    <AlertCircle className="size-8 mb-4" />
                    <p className="font-medium">Failed to load wallpapers</p>
                    <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
                </motion.div>
            </div>
        )
    }

    // Empty state
    if (wallpapers.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <GridHeader onRefresh={handleRefresh} isLoading={isLoading} />
                <motion.div
                    className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                >
                    <FolderOpen className="size-12 mb-4 opacity-50" />
                    <p className="font-medium">No wallpapers found</p>
                    <p className="text-sm mt-1">
                        {searchQuery
                            ? "Try a different search term"
                            : "Install wallpapers from Steam Workshop via Wallpaper Engine"}
                    </p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <GridHeader onRefresh={handleRefresh} isLoading={isLoading} />

            <div className="flex items-start gap-6 flex-1">
                <div
                    id="onboarding-wallpaper-grid"
                    className={`grid flex-1 gap-4 h-fit transition-all duration-300 ${detailsVisible
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                        : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                        }`}
                >
                    {wallpapers.map((wallpaper) => (
                        <WallpaperCard
                            key={wallpaper.id}
                            wallpaper={wallpaper}
                            selected={selectedWallpaper?.id === wallpaper.id}
                            onClick={toggleWallpaper}
                            compatibilityStatus={compatibilityMap?.[wallpaper.path ?? '']}
                            showCompatibilityDot={settings?.showCompatibilityDot ?? true}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait" onExitComplete={() => setDetailsVisible(false)}>
                    {selectedWallpaper && (
                        <motion.div
                            key={selectedWallpaper.id}
                            className="sticky top-0"
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            onAnimationStart={() => setDetailsVisible(true)}
                        >
                            <Suspense fallback={<Skeleton className="w-80 h-96 rounded-xl" />}>
                                <WallpaperDetails
                                    wallpaper={selectedWallpaper}
                                    onClose={() => setSelectedWallpaper(null)}
                                />
                            </Suspense>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    )
}
