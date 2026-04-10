import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { SearchInput } from "@/components/wallpaper/search"
import { WorkshopFiltersDropdown } from "@/components/workshop/workshop-filters-dropdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useDebouncedSearchQuery, useFilter } from "@/contexts/search-context"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { trpc } from "@/lib/trpc"
import type { Wallpaper } from "../../shared/constants/wallpaper"
import type { RouterOutputs } from "../../main/trpc/router"

const WorkshopWallpaperDetails = lazy(() => import("@/components/workshop/workshop-wallpaper-details").then(m => ({ default: m.WorkshopWallpaperDetails })))

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
})

type WorkshopItem = RouterOutputs["workshop"]["getItems"]["items"][number]

function toWallpaper(item: WorkshopItem): Wallpaper {
  return {
    id: item.id,
    workshopId: item.id,
    title: item.title,
    author: item.author,
    ageRating: item.ageRating,
    type: item.type,
    thumbnail: item.previewUrl ?? "",
    previewUrl: item.previewUrl,
    resolution: { width: 0, height: 0 },
    fileSize: 0,
    dateAdded: 0,
    tags: item.tags,
    installed: false,
    path: "",
  }
}

function WorkshopPage() {
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null)
  const [detailsVisible, setDetailsVisible] = useState(false)
  const [page, setPage] = useState(1)
  const { debouncedSearchQuery } = useDebouncedSearchQuery()
  const { filterType, filterAgeRating, filterTags, filterResolution } = useFilter()
  const { setSelectedUrl } = useWallpaperBackground()
  const utils = trpc.useUtils()

  // Reset page and refetch when search or filters change
  useEffect(() => {
    setPage(1)
    utils.workshop.getItems.invalidate()
  }, [debouncedSearchQuery, filterType, filterAgeRating, filterTags, filterResolution, utils])

  // Sync selected wallpaper thumbnail as blurred page background
  useEffect(() => {
    setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
  }, [selectedWallpaper, setSelectedUrl])

  const { data, isLoading, isFetching } = trpc.workshop.getItems.useQuery({
    search: debouncedSearchQuery || undefined,
    page,
  })

  const wallpapers = useMemo(
    () => data?.items.map(toWallpaper) ?? [],
    [data],
  )

  const lastClickTime = useRef(0)
  const THROTTLE_MS = 150

  const toggleWallpaper = useCallback((w: Wallpaper) => {
    const now = Date.now()
    if (now - lastClickTime.current < THROTTLE_MS) return
    lastClickTime.current = now
    setSelectedWallpaper(prev => prev?.id === w.id ? null : w)
  }, [])

  const gridCols = detailsVisible
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"

  return (
    <div className="flex flex-col h-full p-6">
      <PageHeader
        title="Workshop"
        description="Browse wallpapers from Steam Workshop"
      >
        <div className="flex items-center gap-3 max-w-xl mx-auto py-1.5">
          <SearchInput placeholder="Search workshop..." className="flex-1" />
          <WorkshopFiltersDropdown />
        </div>
      </PageHeader>

      <div className="flex items-start gap-6 flex-1">
        <div className="flex-1 h-fit transition-all duration-300 space-y-4">
          <WallpaperGridLayout
            wallpapers={wallpapers}
            isLoading={isLoading}
            showCompatibilityDot={false}
            selectedId={selectedWallpaper?.id}
            onCardClick={toggleWallpaper}
            gridClassName={gridCols}
            emptyIcon={Store}
            emptyMessage="No workshop items found"
            emptySubMessage={
              debouncedSearchQuery
                ? "Try a different search term"
                : "Browse wallpapers on Steam Workshop"
            }
          />

          {data && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Page {data.page} · {data.returnedResults} of {data.totalResults} items
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.hasNextPage || isFetching}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
                <WorkshopWallpaperDetails
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

