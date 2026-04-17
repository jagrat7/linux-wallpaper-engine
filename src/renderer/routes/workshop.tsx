import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react"
import { useAtom } from "jotai"
import { useIntersectionObserver } from "@uidotdev/usehooks"
import { motion, AnimatePresence } from "framer-motion"
import { Compass, LayoutGrid, Store } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { SortDropdown } from "@/components/wallpaper/sort-dropdown"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { SearchInput } from "@/components/wallpaper/search"
import { WorkshopDiscoverSection } from "@/components/workshop/workshop-discover-section"
import { WorkshopConnectionPrompt } from "@/components/workshop/workshop-connection-prompt"
import { WorkshopFiltersDropdown } from "@/components/workshop/workshop-filters-dropdown"
import { WorkshopConnectionButton } from "@/components/workshop/workshop-connection-button"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink, PaginationEllipsis, getPaginationRange } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useDebouncedSearchQuery, useFilter } from "@/contexts/search-context"
import { useWallpaperSelection } from "@/hooks/use-wallpaper-selection"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { trpc } from "@/lib/trpc"
import { DEFAULT_FAVORITE_DISCOVER_SECTION_IDS } from "../../shared/constants/workshop"
import { workshopModeAtom } from "@/contexts/atoms/workshop-atoms"
import type { Wallpaper } from "../../shared/constants/wallpaper"
import type { RouterOutputs } from "../../main/trpc/router"
import { toWallpaper } from "@/lib/utils"

const WorkshopWallpaperDetails = lazy(() => import("@/components/workshop/workshop-wallpaper-details").then(m => ({ default: m.WorkshopWallpaperDetails })))

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
})

const DISCOVER_SECTION_BATCH_SIZE = 4

type WorkshopItem = RouterOutputs["workshop"]["getItems"]["items"][number]
type WorkshopDiscoverSectionData = RouterOutputs["workshop"]["discover"]["sections"][number]



function WorkshopPage() {
  const { selectedWallpaper, setSelectedWallpaper, toggleWallpaper } = useWallpaperSelection()
  const [mode, setMode] = useAtom(workshopModeAtom)
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
  const showBrowse = mode === "browse" || hasSearchQuery
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

  const { data, error, isLoading, isFetching } = trpc.workshop.getItems.useQuery({
    search: debouncedSearchQuery || undefined,
    page,
  }, {
    enabled: showBrowse,
  })

  const { data: discoverData, error: discoverError, isLoading: isDiscoverLoading } = trpc.workshop.discover.useQuery(undefined, {
    enabled: !showBrowse,
  })

  trpc.workshop.onConnectionEvent.useSubscription(undefined, {
    onData: () => {
      void utils.workshop.connectionStatus.invalidate()
      void utils.workshop.getItems.invalidate()
      void utils.workshop.discover.invalidate()

      if (selectedWallpaper) {
        void utils.workshop.status.invalidate({ workshopId: selectedWallpaper.workshopId ?? selectedWallpaper.id })
      }
    },
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

    if (showBrowse || !hasMoreDiscoverSections || !canLoadMoreSections) {
      return
    }

    setCanLoadMoreSections(false)
    setVisibleSectionCount((currentCount) => Math.min(currentCount + DISCOVER_SECTION_BATCH_SIZE, discoverSections.length))
  }, [canLoadMoreSections, discoverSections.length, hasMoreDiscoverSections, showBrowse, loadMoreEntry?.isIntersecting])

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
        action={<WorkshopConnectionButton />}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto pt-1.5">
          <div className="flex items-center gap-1 shrink-0">
            <IconButton
              icon={Compass}
              size="sm"
              pressed={!showBrowse}
              onClick={() => setMode("discover")}
              title="Discover"
            />
            <IconButton
              icon={LayoutGrid}
              size="sm"
              pressed={showBrowse}
              onClick={() => setMode("browse")}
              title="Browse"
            />
          </div>
          <SearchInput placeholder="Search workshop..." className="flex-1" />
          <div className="flex items-center gap-1.5">
            <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
              <WorkshopFiltersDropdown />
            </div>
            <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
              <SortDropdown />
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="flex items-start gap-6 flex-1">
        <div className="flex-1 h-fit transition-all duration-300 space-y-4">
          {showBrowse ? (
            error ? (
              <WorkshopConnectionPrompt message={error.message} />
            ) : (
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

                {data && data.returnedResults > 0 && (() => {
                  const { nearbyPages, totalPages, showFirstPage, showLastPage, showStartEllipsis, showEndEllipsis } = getPaginationRange(page, data.totalResults, data.returnedResults)

                  return (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            aria-disabled={page <= 1 || isFetching}
                            className={page <= 1 || isFetching ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {showFirstPage && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">1</PaginationLink>
                          </PaginationItem>
                        )}
                        {showStartEllipsis && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        {nearbyPages.filter(p => p < page).map(p => (
                          <PaginationItem key={p}>
                            <PaginationLink onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationLink isActive className="cursor-default">{page}</PaginationLink>
                        </PaginationItem>
                        {nearbyPages.filter(p => p > page).map(p => (
                          <PaginationItem key={p}>
                            <PaginationLink onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                          </PaginationItem>
                        ))}
                        {showEndEllipsis && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        {showLastPage && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage(prev => prev + 1)}
                            aria-disabled={!data.hasNextPage || isFetching}
                            className={!data.hasNextPage || isFetching ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )
                })()}
              </>
            )
          ) : (
            <div className="space-y-10">
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
              ) : discoverError ? (
                <WorkshopConnectionPrompt message={discoverError.message} />
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

