import { useEffect, useMemo, useRef, useState } from "react"
import { useIntersectionObserver } from "@uidotdev/usehooks"
import { ArrowDown, ArrowLeft, Star, Store } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { WorkshopConnectionPrompt } from "@/components/workshop/workshop-connection-prompt"
import { WorkshopDiscoverSection } from "@/components/workshop/workshop-discover-section"
import { WorkshopPagination } from "@/components/workshop/workshop-pagination"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/lib/trpc"
import { cn, toWallpaper } from "@/lib/utils"
import { useGlass } from "@/hooks/use-glass"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { WorkshopSortBy } from "../../../shared/constants/workshop"
import { DEFAULT_FAVORITE_DISCOVER_SECTION_IDS } from "../../../shared/constants/workshop"
import type { RouterOutputs } from "../../../main/trpc/router"

type WorkshopDiscoverSectionData = RouterOutputs["workshop"]["discover"]["sections"][number]

const DISCOVER_SECTION_BATCH_SIZE = 4
const SKELETON_SECTION_COUNT = 2
const SKELETON_CARDS_PER_SECTION = 6

interface WorkshopDiscoverViewProps {
  sortBy: WorkshopSortBy
  selectedId: string | undefined
  onCardClick: (w: Wallpaper) => void
  gridClassName: string
}

export function WorkshopDiscoverView({
  sortBy,
  selectedId,
  onCardClick,
  gridClassName,
}: WorkshopDiscoverViewProps) {
  const glass = useGlass()
  const [visibleSectionCount, setVisibleSectionCount] = useState(DISCOVER_SECTION_BATCH_SIZE)
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null)
  const [focusedPage, setFocusedPage] = useState(1)
  const wasIntersectingRef = useRef(false)
  const utils = trpc.useUtils()

  const { data: settings } = trpc.settings.get.useQuery()
  const favoriteSectionIds = settings?.favoriteDiscoverSectionIds ?? DEFAULT_FAVORITE_DISCOVER_SECTION_IDS

  const updateSettings = trpc.settings.update.useMutation({
    onMutate: async (input) => {
      await utils.settings.get.cancel()
      const previousSettings = utils.settings.get.getData()
      utils.settings.get.setData(undefined, currentSettings => {
        if (!currentSettings) return currentSettings
        return { ...currentSettings, ...input }
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

  const onToggleFavoriteSection = (sectionId: string) => {
    const next = favoriteSectionIds.includes(sectionId)
      ? favoriteSectionIds.filter((id: string) => id !== sectionId)
      : [...favoriteSectionIds, sectionId]
    updateSettings.mutate({ favoriteDiscoverSectionIds: next })
  }

  const isFocused = focusedSectionId !== null

  const { data, error, isLoading, isFetching } = trpc.workshop.discover.useQuery(
    isFocused
      ? { sortBy, focusedSectionId, page: focusedPage }
      : { sortBy },
  )

  trpc.workshop.onConnectionEvent.useSubscription(undefined, {
    onData: () => {
      if (error) void utils.workshop.discover.invalidate()
    },
  })

  const [loadMoreRef, loadMoreEntry] = useIntersectionObserver({
    threshold: 0,
    rootMargin: "360px 0px",
  })

  const sections = useMemo(() => {
    const mapped = data?.sections.map((section: WorkshopDiscoverSectionData) => ({
      id: section.id,
      title: section.title,
      wallpapers: section.items.map(toWallpaper),
      page: section.page,
      totalResults: section.totalResults,
      resultsPerPage: section.resultsPerPage,
      hasNextPage: section.hasNextPage,
    })) ?? []
    if (isFocused) return mapped
    const favoriteSet = new Set(favoriteSectionIds)
    const favorites = mapped.filter(section => favoriteSet.has(section.id))
    const rest = mapped.filter(section => !favoriteSet.has(section.id))
    return [...favorites, ...rest]
  }, [data, favoriteSectionIds, isFocused])

  const visibleSections = useMemo(
    () => sections.slice(0, visibleSectionCount),
    [sections, visibleSectionCount],
  )

  const hasMore = visibleSectionCount < sections.length

  useEffect(() => {
    if (isFocused) return
    const isIntersecting = loadMoreEntry?.isIntersecting ?? false
    if (isIntersecting && !wasIntersectingRef.current && hasMore) {
      setVisibleSectionCount(current => Math.min(current + DISCOVER_SECTION_BATCH_SIZE, sections.length))
    }
    wasIntersectingRef.current = isIntersecting
  }, [loadMoreEntry?.isIntersecting, hasMore, sections.length, isFocused])

  const onSeeMore = (sectionId: string) => {
    setFocusedSectionId(sectionId)
    setFocusedPage(1)
  }

  const onExitFocus = () => {
    setFocusedSectionId(null)
    setFocusedPage(1)
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        {Array.from({ length: SKELETON_SECTION_COUNT }).map((_, index) => (
          <div key={index} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div className="flex items-baseline gap-3">
                  <Skeleton className="h-7 w-40" />
                  <span className="text-xs text-muted-foreground">
                    See more <ArrowDown className="inline-block size-3" />
                  </span>
                </div>
                <IconButton
                  icon={Star}
                  size="sm"
                  disabled
                  aria-label="Add to favorites"
                  title="Add to favorites"
                />
              </div>
            </div>
            <div className={`grid gap-4 ${gridClassName}`}>
              {Array.from({ length: SKELETON_CARDS_PER_SECTION }).map((__, skeletonIndex) => (
                <Skeleton key={skeletonIndex} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) return <WorkshopConnectionPrompt message={error.message} />

  if (isFocused) {
    const focusedSection = sections[0]
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
          <div className="flex items-center gap-3">
            <IconButton
              icon={ArrowLeft}
              size="sm"
              onClick={onExitFocus}
              aria-label="Back to categories"
              title="Back to categories"
            />
            <h2 className="text-xl font-semibold">{focusedSection?.title ?? ""}</h2>
          </div>
        </div>

        <WallpaperGridLayout
          wallpapers={focusedSection?.wallpapers ?? []}
          isLoading={isFetching}
          showCompatibilityDot={false}
          selectedId={selectedId}
          onCardClick={onCardClick}
          gridClassName={gridClassName}
          emptyIcon={Store}
          emptyMessage="No wallpapers in this category"
        />

        {focusedSection && focusedSection.wallpapers.length > 0 && (
          <WorkshopPagination
            page={focusedSection.page}
            totalResults={focusedSection.totalResults}
            resultsPerPage={focusedSection.resultsPerPage}
            hasNextPage={focusedSection.hasNextPage}
            isFetching={isFetching}
            onPageChange={setFocusedPage}
          />
        )}
      </div>
    )
  }

  if (visibleSections.length === 0) {
    return (
      <WallpaperGridLayout
        wallpapers={[]}
        isLoading={false}
        showCompatibilityDot={false}
        selectedId={selectedId}
        onCardClick={onCardClick}
        gridClassName={gridClassName}
        emptyIcon={Store}
        emptyMessage="No discover categories found"
        emptySubMessage="Try adjusting your workshop filters"
      />
    )
  }

  return (
    <div className="space-y-10">
      {visibleSections.map((section) => (
        <WorkshopDiscoverSection
          key={section.id}
          id={section.id}
          title={section.title}
          wallpapers={section.wallpapers}
          totalResults={section.totalResults}
          isFavorite={favoriteSectionIds.includes(section.id)}
          selectedId={selectedId}
          onCardClick={onCardClick}
          onFavoriteToggle={onToggleFavoriteSection}
          onSeeMore={onSeeMore}
          gridClassName={gridClassName}
        />
      ))}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-2">
          <div className={cn(glass, "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground")}>
            Loading more categories
          </div>
        </div>
      )}
    </div>
  )
}
