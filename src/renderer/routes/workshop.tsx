import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react"
import { useIntersectionObserver } from "@uidotdev/usehooks"
import { motion, AnimatePresence } from "framer-motion"
import { Store } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { SearchInput } from "@/components/wallpaper/search"
import { WorkshopDiscoverSection } from "@/components/workshop/workshop-discover-section"
import { WorkshopFiltersDropdown } from "@/components/workshop/workshop-filters-dropdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useDebouncedSearchQuery, useFilter } from "@/contexts/search-context"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { trpc } from "@/lib/trpc"
import { DEFAULT_FAVORITE_DISCOVER_SECTION_IDS } from "../../shared/constants/workshop"
import type { Wallpaper } from "../../shared/constants/wallpaper"
import type { RouterOutputs } from "../../main/trpc/router"

const WorkshopWallpaperDetails = lazy(() => import("@/components/workshop/workshop-wallpaper-details").then(m => ({ default: m.WorkshopWallpaperDetails })))

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
})

const DISCOVER_SECTION_BATCH_SIZE = 4

type WorkshopItem = RouterOutputs["workshop"]["getItems"]["items"][number]
type WorkshopDiscoverSectionData = RouterOutputs["workshop"]["discover"]["sections"][number]

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
  const [visibleSectionCount, setVisibleSectionCount] = useState(DISCOVER_SECTION_BATCH_SIZE)
  const [canLoadMoreSections, setCanLoadMoreSections] = useState(true)
  const [favoriteDiscoverSectionIds, setFavoriteDiscoverSectionIds] = useState<string[]>(DEFAULT_FAVORITE_DISCOVER_SECTION_IDS)
  const { debouncedSearchQuery } = useDebouncedSearchQuery()
  const { filterType, filterAgeRating, filterTags, filterResolution } = useFilter()
  const { setSelectedUrl } = useWallpaperBackground()
  const utils = trpc.useUtils()
  const { data: settings } = trpc.settings.get.useQuery()
  const updateSettings = trpc.settings.update.useMutation({
    onMutate: async (input) => {
      await utils.settings.get.cancel()
      const previousSettings = utils.settings.get.getData()

      utils.settings.get.setData(undefined, currentSettings => {
        if (!currentSettings) {
          return currentSettings
        }

        return {
          ...currentSettings,
          ...input,
        }
      })

      return { previousSettings }
    },
    onError: (_error, _input, context) => {
      if (context?.previousSettings) {
        utils.settings.get.setData(undefined, context.previousSettings)
      }
    },
    onSettled: () => {
      void utils.settings.get.invalidate()
    },
  })
  const hasSearchQuery = (debouncedSearchQuery?.trim().length ?? 0) > 0
  const [loadMoreRef, loadMoreEntry] = useIntersectionObserver({
    threshold: 0,
    rootMargin: "360px 0px",
  })

  // Reset page and refetch when search or filters change
  useEffect(() => {
    setPage(1)
    setVisibleSectionCount(DISCOVER_SECTION_BATCH_SIZE)
    setCanLoadMoreSections(true)
    void utils.workshop.getItems.invalidate()
    void utils.workshop.discover.invalidate()
  }, [debouncedSearchQuery, filterType, filterAgeRating, filterTags, filterResolution, utils])

  // Sync selected wallpaper thumbnail as blurred page background
  useEffect(() => {
    setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
  }, [selectedWallpaper, setSelectedUrl])

  useEffect(() => {
    setFavoriteDiscoverSectionIds(settings?.favoriteDiscoverSectionIds ?? DEFAULT_FAVORITE_DISCOVER_SECTION_IDS)
  }, [settings?.favoriteDiscoverSectionIds])

  const { data, isLoading, isFetching } = trpc.workshop.getItems.useQuery({
    search: debouncedSearchQuery || undefined,
    page,
  }, {
    enabled: hasSearchQuery,
  })

  const { data: discoverData, isLoading: isDiscoverLoading } = trpc.workshop.discover.useQuery(undefined, {
    enabled: !hasSearchQuery,
  })

  const wallpapers = useMemo(
    () => data?.items.map(toWallpaper) ?? [],
    [data],
  )

  const discoverSections = useMemo(
    () => {
      const sections = discoverData?.sections.map((section: WorkshopDiscoverSectionData) => ({
        id: section.id,
        title: section.title,
        wallpapers: section.items.map(toWallpaper),
      })) ?? []
      const favoriteSectionIds = new Set(favoriteDiscoverSectionIds)
      const favoriteSections = sections.filter(section => favoriteSectionIds.has(section.id))
      const nonFavoriteSections = sections.filter(section => !favoriteSectionIds.has(section.id))

      return [...favoriteSections, ...nonFavoriteSections]
    },
    [discoverData], // intentionally omits favoriteDiscoverSectionIds — sort order frozen for current visit, reorders on next data fetch
  )

  const visibleDiscoverSections = useMemo(
    () => discoverSections.slice(0, visibleSectionCount),
    [discoverSections, visibleSectionCount],
  )

  const hasMoreDiscoverSections = visibleSectionCount < discoverSections.length

  useEffect(() => {
    if (!loadMoreEntry?.isIntersecting) {
      setCanLoadMoreSections(true)
      return
    }

    if (hasSearchQuery || !hasMoreDiscoverSections || !canLoadMoreSections) {
      return
    }

    setCanLoadMoreSections(false)
    setVisibleSectionCount((currentCount) => Math.min(currentCount + DISCOVER_SECTION_BATCH_SIZE, discoverSections.length))
  }, [canLoadMoreSections, discoverSections.length, hasMoreDiscoverSections, hasSearchQuery, loadMoreEntry?.isIntersecting])

  const lastClickTime = useRef(0)
  const THROTTLE_MS = 150

  const toggleWallpaper = useCallback((w: Wallpaper) => {
    const now = Date.now()
    if (now - lastClickTime.current < THROTTLE_MS) return
    lastClickTime.current = now
    setSelectedWallpaper(prev => prev?.id === w.id ? null : w)
  }, [])

  const toggleFavoriteSection = useCallback((sectionId: string) => {
    setFavoriteDiscoverSectionIds((currentFavoriteSectionIds) => {
      const nextFavoriteSectionIds = currentFavoriteSectionIds.includes(sectionId)
        ? currentFavoriteSectionIds.filter((favoriteSectionId) => favoriteSectionId !== sectionId)
        : [...currentFavoriteSectionIds, sectionId]

      updateSettings.mutate({
        favoriteDiscoverSectionIds: nextFavoriteSectionIds,
      })

      return nextFavoriteSectionIds
    })
  }, [updateSettings])

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
          {hasSearchQuery ? (
            <>
              <WallpaperGridLayout
                wallpapers={wallpapers}
                isLoading={isLoading}
                showCompatibilityDot={false}
                selectedId={selectedWallpaper?.id}
                onCardClick={toggleWallpaper}
                gridClassName={gridCols}
                emptyIcon={Store}
                emptyMessage="No workshop items found"
                emptySubMessage="Try a different search term"
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
            </>
          ) : (
            <div className="space-y-8">
              {isDiscoverLoading ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="space-y-4">
                    <Skeleton className="glass h-11 w-48 rounded-full" />
                    <div className={`grid gap-4 ${gridCols}`}>
                      {Array.from({ length: 6 }).map((__, skeletonIndex) => (
                        <Skeleton key={skeletonIndex} className="aspect-[4/3] rounded-xl" />
                      ))}
                    </div>
                  </div>
                ))
              ) : visibleDiscoverSections.length > 0 ? (
                <>
                  {visibleDiscoverSections.map((section) => (
                    <WorkshopDiscoverSection
                      key={section.id}
                      id={section.id}
                      title={section.title}
                      wallpapers={section.wallpapers}
                      isFavorite={favoriteDiscoverSectionIds.includes(section.id)}
                      selectedId={selectedWallpaper?.id}
                      onCardClick={toggleWallpaper}
                      onFavoriteToggle={toggleFavoriteSection}
                      gridClassName={gridCols}
                    />
                  ))}

                  {hasMoreDiscoverSections && (
                    <div ref={loadMoreRef} className="flex justify-center py-2">
                      <div className="glass rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Loading more categories
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <WallpaperGridLayout
                  wallpapers={[]}
                  isLoading={false}
                  showCompatibilityDot={false}
                  selectedId={selectedWallpaper?.id}
                  onCardClick={toggleWallpaper}
                  gridClassName={gridCols}
                  emptyIcon={Store}
                  emptyMessage="No discover categories found"
                  emptySubMessage="Try adjusting your workshop filters"
                />
              )}
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

