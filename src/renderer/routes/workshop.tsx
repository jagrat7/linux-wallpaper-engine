import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { WallpaperDetails } from "@/components/wallpaper/wallpaper-details"
import { SearchInput } from "@/components/wallpaper/search"
import { Button } from "@/components/ui/button"
import { useDebouncedSearchQuery } from "@/contexts/search-context"
import { trpc } from "@/lib/trpc"
import type { Wallpaper } from "../../shared/constants/wallpaper"
import type { RouterOutputs } from "../../main/trpc/router"

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
  const [page, setPage] = useState(1)
  const { debouncedSearchQuery } = useDebouncedSearchQuery()

  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery])

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

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Workshop</h2>
        <SearchInput placeholder="Search workshop..." className="w-64" />
      </div>

      <div className="flex items-start gap-6 flex-1">
        <div className="flex-1 h-fit transition-all duration-300 space-y-4">
          <WallpaperGridLayout
            wallpapers={wallpapers}
            isLoading={isLoading}
            showCompatibilityDot={false}
            selectedId={selectedWallpaper?.id}
            onCardClick={toggleWallpaper}
            emptyIcon={Store}
            emptyMessage="No workshop items found"
            emptySubMessage={
              debouncedSearchQuery
                ? "Try a different search term"
                : "Browse wallpapers on Steam Workshop"
            }
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {data ? `Page ${data.page} · ${data.returnedResults} of ${data.totalResults} items` : ""}
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
                disabled={!data?.hasNextPage || isFetching}
                onClick={() => setPage(prev => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedWallpaper && (
            <motion.div
              key={selectedWallpaper.id}
              className="sticky top-0 w-80 shrink-0"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <WallpaperDetails
                wallpaper={selectedWallpaper}
                onClose={() => setSelectedWallpaper(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

