import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { PageHeader } from "@/components/page-header"
import { WorkshopToolbar } from "@/components/workshop/workshop-toolbar"
import { WorkshopBrowseView } from "@/components/workshop/workshop-browse-view"
import { WorkshopDiscoverView } from "@/components/workshop/workshop-discover-view"
import { WorkshopDetailsPanel } from "@/components/workshop/workshop-details-panel"
import { WallpaperGridShell } from "@/components/wallpaper/wallpaper-grid-shell"
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

      <WallpaperGridShell
        detailsKey={selectedWallpaper?.id}
        details={selectedWallpaper ? (
          <WorkshopDetailsPanel
            wallpaper={selectedWallpaper}
            onClose={() => setSelectedWallpaper(null)}
          />
        ) : null}
      >
        {(columns) => (
          <div className="space-y-4">
            {showBrowse ? (
              <WorkshopBrowseView
                key={viewKey}
                searchQuery={debouncedSearchQuery}
                sortBy={workshopSortBy}
                selectedId={selectedWallpaper?.id}
                onCardClick={toggleWallpaper}
                columns={columns}
              />
            ) : (
              <WorkshopDiscoverView
                key={viewKey}
                sortBy={workshopSortBy}
                selectedId={selectedWallpaper?.id}
                onCardClick={toggleWallpaper}
                columns={columns}
              />
            )}
          </div>
        )}
      </WallpaperGridShell>
      <ScrollToTopButton />
    </div>
  )
}
