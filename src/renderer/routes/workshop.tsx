import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { PageHeader } from "@/components/page-header"
import { WorkshopToolbar } from "@/components/workshop/workshop-toolbar"
import { WorkshopBrowseView } from "@/components/workshop/workshop-browse-view"
import { WorkshopDiscoverView } from "@/components/workshop/workshop-discover-view"
import { WorkshopDetailsPanel } from "@/components/workshop/workshop-details-panel"
import { ScrollToTopButton } from "@/components/scroll-to-top-button"
import { RefreshButton } from "@/components/wallpaper/refresh-button"
import { useDebouncedWorkshopSearchQuery, useWorkshopFilter, useWorkshopSort } from "@/contexts/workshop-search-context"
import { useWallpaperSelection } from "@/hooks/use-wallpaper-selection"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { trpc } from "@/lib/trpc"
import { workshopModeAtom } from "@/contexts/atoms/workshop-atoms"

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
})

function WorkshopPage() {
  const { selectedWallpaper, setSelectedWallpaper, toggleWallpaper } = useWallpaperSelection()
  const [mode, setMode] = useAtom(workshopModeAtom)
  const { sortBy: workshopSortBy } = useWorkshopSort()
  const [detailsVisible, setDetailsVisible] = useState(false)
  const { debouncedSearchQuery } = useDebouncedWorkshopSearchQuery()
  const { filterType, filterAgeRating, filterTags, filterResolution } = useWorkshopFilter()
  const { setSelectedUrl } = useWallpaperBackground()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const utils = trpc.useUtils()

  const hasSearchQuery = (debouncedSearchQuery?.trim().length ?? 0) > 0
  const showBrowse = mode === "browse" || hasSearchQuery

  // Sync selected wallpaper thumbnail as blurred page background
  useEffect(() => {
    setSelectedUrl(selectedWallpaper?.thumbnail ?? null)
  }, [selectedWallpaper, setSelectedUrl])

  // Shrink grid immediately when a wallpaper is selected; the false flip is
  // deferred to onExitComplete so columns expand only after the panel exits.
  useEffect(() => {
    if (selectedWallpaper) setDetailsVisible(true)
  }, [selectedWallpaper])

  trpc.workshop.onConnectionEvent.useSubscription(undefined, {
    onData: () => {
      if (selectedWallpaper) {
        void utils.workshop.status.invalidate({ workshopId: selectedWallpaper.workshopId ?? selectedWallpaper.id })
      }
    },
  })

  const viewKey = [
    debouncedSearchQuery,
    filterType.join(","),
    filterAgeRating.join(","),
    filterTags.join(","),
    filterResolution.join(","),
    workshopSortBy,
  ].join("|")

  const gridCols = detailsVisible
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await (showBrowse
        ? utils.workshop.getItems.invalidate()
        : utils.workshop.discover.invalidate())
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-6">
      <PageHeader
        title="Workshop"
        description="Browse wallpapers from Steam Workshop"
        action={<RefreshButton onClick={handleRefresh} isLoading={isRefreshing} />}
      >
        <WorkshopToolbar
          showBrowse={showBrowse}
          onSelectDiscover={() => setMode("discover")}
          onSelectBrowse={() => setMode("browse")}
        />
      </PageHeader>

      <div className="flex items-start gap-6 flex-1">
        <div className="flex-1 h-fit transition-all duration-300 space-y-4">
          {showBrowse ? (
            <WorkshopBrowseView
              key={viewKey}
              searchQuery={debouncedSearchQuery}
              sortBy={workshopSortBy}
              selectedId={selectedWallpaper?.id}
              onCardClick={toggleWallpaper}
              gridClassName={gridCols}
            />
          ) : (
            <WorkshopDiscoverView
              key={viewKey}
              sortBy={workshopSortBy}
              selectedId={selectedWallpaper?.id}
              onCardClick={toggleWallpaper}
              gridClassName={gridCols}
            />
          )}
        </div>

        <WorkshopDetailsPanel
          wallpaper={selectedWallpaper}
          onClose={() => setSelectedWallpaper(null)}
          onExitComplete={() => setDetailsVisible(false)}
        />
      </div>
      <ScrollToTopButton />
    </div>
  )
}
