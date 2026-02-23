import { motion, AnimatePresence } from "framer-motion"
import { type Wallpaper } from "./wallpaper-card"
import { GridHeader } from "./wallpaper-grid-header"
import { WallpaperGridLayout } from "./wallpaper-grid-layout"
import { AlertCircle, FolderOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearch } from "@/contexts/search-context"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react"

const WallpaperDetails = lazy(() => import("./wallpaper-details").then(m => ({ default: m.WallpaperDetails })))

// TODO: Fix wallpaper details size so that is consistent width with a column
export function WallpaperGrid() {
    const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null)
    const [detailsVisible, setDetailsVisible] = useState(false)
    const { searchQuery, filterType, filterTags, filterResolution, sortBy, sortOrder, setAvailableTags, setAvailableResolutions, filterCompatibility } = useSearch()
    const { setSelectedUrl } = useWallpaperBackground()

    const {
        rawWallpapers,
        wallpapers: transformedWallpapers,
        isLoading,
        error,
        refetch,
        compatibilityMap,
        appSettings,
    } = useWallpapers()

    // Throttle wallpaper selection to prevent UI freezing from rapid clicks
    const lastClickTime = useRef(0)
    const THROTTLE_MS = 150

    // Filter and sort wallpapers
    const wallpapers: Wallpaper[] = useMemo(() =>
        filterAndSortWallpapers(transformedWallpapers, {
            filterType,
            filterTags,
            filterResolution,
            filterCompatibility,
            sortBy,
            sortOrder,
            compatibilityMap,
        }),
        [transformedWallpapers, filterType, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    // Sync selected wallpaper thumbnail as blurred page background
    useEffect(() => {
        setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
    }, [selectedWallpaper, setSelectedUrl])


    // Extract and set available tags from raw data (before filtering)
    useEffect(() => {
        if (!rawWallpapers) return

        const { tags, resolutions } = rawWallpapers.reduce((acc, item) => {

            item.tags && acc.tags.push(...item.tags)


            acc.resolutions.push(!item.resolution.height || !item.resolution.width ? "Unknown" : `${item.resolution.width}x${item.resolution.height}`)

            return acc
        },
            {
                tags: [] as string[],
                resolutions: [] as string[],
            },
        )


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

    }, [rawWallpapers, setAvailableTags, setAvailableResolutions])


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

    const gridCols = detailsVisible
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"

    return (
        <div className="flex flex-col h-full">
            <GridHeader onRefresh={handleRefresh} isLoading={isLoading} />

            <div className="flex items-start gap-6 flex-1">
                <div
                    id="onboarding-wallpaper-grid"
                    className="flex-1 h-fit transition-all duration-300"
                >
                    <WallpaperGridLayout
                        wallpapers={wallpapers}
                        isLoading={isLoading}
                        compatibilityMap={compatibilityMap}
                        showCompatibilityDot={appSettings?.showCompatibilityDot ?? true}
                        selectedId={selectedWallpaper?.id}
                        onCardClick={toggleWallpaper}
                        gridClassName={gridCols}
                        emptyIcon={FolderOpen}
                        emptyMessage="No wallpapers found"
                        emptySubMessage={
                            searchQuery
                                ? "Try a different search term"
                                : "Install wallpapers from Steam Workshop via Wallpaper Engine"
                        }
                    />
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
