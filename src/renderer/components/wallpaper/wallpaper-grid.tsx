import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { type Wallpaper } from "./wallpaper-card"
import { GridHeader } from "./wallpaper-grid-header"
import { VirtualizedWallpaperGrid, type VirtualizedWallpaperGridHandle } from "./virtualized-wallpaper-grid"
import { AlertCircle, FolderOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useWallpaperSearch } from "@/contexts/wallpaper-search-context"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useWallpaperSelection } from "@/hooks/use-wallpaper-selection"
import { useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react"
import { useAtomValue } from "jotai"
import { unsubscribedWorkshopIdsAtom } from "@/contexts/atoms/workshop-atoms"

const WallpaperDetails = lazy(() => import("./details-card/wallpaper-details").then(m => ({ default: m.WallpaperDetails })))

// TODO: Fix wallpaper details size so that is consistent width with a column
export function WallpaperGrid() {
    const gridRef = useRef<VirtualizedWallpaperGridHandle>(null)
    const { selectedWallpaper, setSelectedWallpaper, toggleWallpaper } = useWallpaperSelection()
    const unsubscribedWorkshopIds = useAtomValue(unsubscribedWorkshopIdsAtom)
    const { searchQuery, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, setAvailableTags, setAvailableResolutions, filterCompatibility } = useWallpaperSearch()
    const { setSelectedUrl } = useWallpaperBackground()

    const {
        rawWallpapers,
        wallpapers: transformedWallpapers,
        isLoading,
        isFetching,
        error,
        refetch,
        compatibilityMap,
        appSettings,
    } = useWallpapers()

    // Filter and sort wallpapers
    const wallpapers: Wallpaper[] = useMemo(() => {
        const visibleWallpapers = transformedWallpapers.filter(wallpaper => !unsubscribedWorkshopIds.has(wallpaper.workshopId ?? wallpaper.id))

        return filterAndSortWallpapers(visibleWallpapers, {
            searchQuery,
            filterType,
            filterAgeRating,
            filterTags,
            filterResolution,
            filterCompatibility,
            sortBy,
            sortOrder,
            compatibilityMap,
        })
    },
        [transformedWallpapers, unsubscribedWorkshopIds, searchQuery, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    // Sync selected wallpaper thumbnail as blurred page background
    useEffect(() => {
        setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
    }, [selectedWallpaper, setSelectedUrl])

    // Open details card when navigated here with ?wallpaper=<id> (e.g. from the status bar)
    const { wallpaper: requestedWallpaperId } = useSearch({ from: "/" })
    const navigate = useNavigate()
    
    const requestedWallpaper = useMemo(
        () => transformedWallpapers.find(w => w.id === requestedWallpaperId) ?? null,
        [requestedWallpaperId, transformedWallpapers]
    )

    useEffect(() => {
        if (!requestedWallpaper) return
        setSelectedWallpaper(requestedWallpaper)

        // Clear the param so closing the card or re-clicking works as expected
        navigate({ to: "/", search: {}, replace: true })
    }, [requestedWallpaper, setSelectedWallpaper, navigate])



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


    const handleRefresh = () => {
        refetch()
    }

    const handleUnsubscribe = () => {
        setSelectedWallpaper(null)
    }

    const handleCloseDetails = useCallback(() => {
        const path = selectedWallpaper?.path ?? selectedWallpaper?.id
        setSelectedWallpaper(null)
        if (path) requestAnimationFrame(() => gridRef.current?.scrollToPath(path))
    }, [selectedWallpaper, setSelectedWallpaper])

    // Error state
    if (error) {
        return (
            <div className="flex flex-col h-full">
                <GridHeader onRefresh={handleRefresh} isLoading={isFetching} />
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

    return (
        <div className="flex flex-col h-full">
            <GridHeader onRefresh={handleRefresh} isLoading={isFetching} />

            <div className="flex items-start gap-6 flex-1">
                <div className="flex-1 h-fit transition-all duration-300">
                    <VirtualizedWallpaperGrid
                        ref={gridRef}
                        wallpapers={wallpapers}
                        isLoading={isLoading}
                        compatibilityMap={compatibilityMap}
                        showCompatibilityDot={appSettings?.showCompatibilityDot ?? true}
                        selectedId={selectedWallpaper?.id}
                        onCardClick={toggleWallpaper}
                        emptyIcon={FolderOpen}
                        emptyMessage="No wallpapers found"
                        emptySubMessage={
                            searchQuery
                                ? "Try a different search term"
                                : "Install wallpapers from Steam Workshop via Wallpaper Engine"
                        }
                    />
                </div>

                <AnimatePresence mode="wait">
                    {selectedWallpaper && (
                        <motion.div
                            key={selectedWallpaper.id}
                            className="sticky top-0"
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <Suspense fallback={<Skeleton className="w-80 h-96 rounded-xl" />}>
                                <WallpaperDetails
                                    key={selectedWallpaper.id}
                                    wallpaper={selectedWallpaper}
                                    onClose={handleCloseDetails}
                                    onUnsubscribe={handleUnsubscribe}
                                />
                            </Suspense>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    )
}
