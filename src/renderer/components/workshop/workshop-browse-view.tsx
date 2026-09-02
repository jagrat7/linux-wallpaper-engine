import { useMemo, useState } from "react"
import { Store } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { WorkshopConnectionPrompt } from "@/components/workshop/workshop-connection-prompt"
import { WorkshopPagination } from "@/components/workshop/workshop-pagination"
import { trpc } from "@/lib/trpc"
import { toWallpaper } from "@/lib/utils"
import { encodeWorkshopCursor } from "../../../shared/utils/workshop-cursor"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { WorkshopSortBy } from "../../../shared/constants/workshop"

interface WorkshopBrowseViewProps {
  searchQuery: string
  sortBy: WorkshopSortBy
  selectedId: string | undefined
  onCardClick: (w: Wallpaper) => void
  columns: number
}

export function WorkshopBrowseView({
  searchQuery,
  sortBy,
  selectedId,
  onCardClick,
  columns,
}: WorkshopBrowseViewProps) {
  const [page, setPage] = useState(1)
  const utils = trpc.useUtils()
  const { data, error, isLoading, isFetching } = trpc.workshop.getItems.useQuery({
    search: searchQuery || undefined,
    cursor: encodeWorkshopCursor(page),
    sortBy,
  })

  trpc.workshop.onConnectionEvent.useSubscription(undefined, {
    onData: () => {
      if (error) void utils.workshop.getItems.invalidate()
    },
  })

  const wallpapers = useMemo(
    () => data?.items.map(toWallpaper) ?? [],
    [data],
  )

  if (error) return <WorkshopConnectionPrompt message={error.message} />

  return (
    <>
      <WallpaperGridLayout
        wallpapers={wallpapers}
        isLoading={isLoading}
        showCompatibilityDot={false}
        selectedId={selectedId}
        onCardClick={onCardClick}
        columns={columns}
        emptyIcon={Store}
        emptyMessage="No workshop items found"
        emptySubMessage="Try a different search term"
      />

      {data && data.returnedResults > 0 && (
        <WorkshopPagination
          page={page}
          totalResults={data.totalResults}
          resultsPerPage={data.resultsPerPage}
          hasNextPage={data.hasNextPage}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      )}
    </>
  )
}
