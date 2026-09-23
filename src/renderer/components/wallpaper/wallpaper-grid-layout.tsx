import { memo, useId, useMemo, type ReactNode } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { FolderOpen, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { WallpaperCard } from './wallpaper-card'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import type { CompatibilityStatus } from '../../../shared/constants/compatibility'
import { WALLPAPER_GRID_SKELETON_COUNT } from '../../../shared/constants/grid'
import { useGlass } from '@/hooks/use-glass'
import { WALLPAPER_GRID_TRANSITION } from './wallpaper-grid-shell'
import {
  useWallpaperGridNavigation,
  type WallpaperGridItemProps,
} from '@/hooks/use-wallpaper-grid-navigation'

interface WallpaperGridLayoutProps {
  wallpapers: Wallpaper[]
  isLoading: boolean
  compatibilityMap?: Record<string, CompatibilityStatus>
  showCompatibilityDot?: boolean
  selectedId?: string
  isSelected?: (wallpaper: Wallpaper) => boolean
  onCardClick: (wallpaper: Wallpaper) => void
  emptyIcon?: LucideIcon
  emptyMessage?: string
  emptySubMessage?: string
  renderCardOverlay?: (wallpaper: Wallpaper) => ReactNode
  columns: number
}

interface WallpaperGridCardItemProps {
  wallpaper: Wallpaper
  selected: boolean
  onClick: (wallpaper: Wallpaper) => void
  compatibilityStatus?: CompatibilityStatus
  showCompatibilityDot: boolean
  glassClassName: string
  overlay?: ReactNode
  rowIndex: number
  columnIndex: number
  itemProps: WallpaperGridItemProps
}

// Memoized so a parent re-render (e.g. selection change) only re-renders the
// cards whose props actually changed, not the whole grid.
const WallpaperGridCardItem = memo(function WallpaperGridCardItem({
  wallpaper,
  selected,
  onClick,
  compatibilityStatus,
  showCompatibilityDot,
  glassClassName,
  overlay,
  rowIndex,
  columnIndex,
  itemProps,
}: WallpaperGridCardItemProps) {
  return (
    <motion.div
      role="gridcell"
      aria-rowindex={rowIndex + 1}
      aria-colindex={columnIndex + 1}
      layout
      layoutId={wallpaper.id}
      transition={WALLPAPER_GRID_TRANSITION}
      className="relative"
      data-wallpaper-path={wallpaper.path}
      data-wallpaper-id={wallpaper.id}
    >
      <WallpaperCard
        wallpaper={wallpaper}
        selected={selected}
        onClick={onClick}
        compatibilityStatus={compatibilityStatus}
        showCompatibilityDot={showCompatibilityDot}
        glassClassName={glassClassName}
        {...itemProps}
      />
      {overlay}
    </motion.div>
  )
})

export function WallpaperGridLayout({
  wallpapers,
  isLoading,
  compatibilityMap,
  showCompatibilityDot = true,
  selectedId,
  isSelected,
  onCardClick,
  emptyIcon: EmptyIcon = FolderOpen,
  emptyMessage = 'No wallpapers found',
  emptySubMessage,
  renderCardOverlay,
  columns,
}: WallpaperGridLayoutProps) {
  // Resolved once for the whole grid — cards must not subscribe individually.
  const glass = useGlass()
  const layoutGroupId = useId()
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
  const itemIds = useMemo(
    () => wallpapers.map((wallpaper) => wallpaper.path ?? wallpaper.id),
    [wallpapers],
  )
  const rowCount = Math.ceil(wallpapers.length / columns)
  const { getItemProps } = useWallpaperGridNavigation({ itemIds, columns })

  if (isLoading) {
    return (
      <div className="grid gap-4" style={gridStyle}>
        {Array.from({ length: WALLPAPER_GRID_SKELETON_COUNT }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    )
  }

  if (wallpapers.length === 0) {
    return <EmptyState icon={EmptyIcon} title={emptyMessage} description={emptySubMessage} />
  }

  return (
    <LayoutGroup id={layoutGroupId}>
      <div
        role="grid"
        aria-label="Wallpapers"
        aria-rowcount={rowCount}
        aria-colcount={columns}
        className="grid gap-4"
        style={gridStyle}
      >
        {Array.from({ length: rowCount }, (_, rowIndex) => (
          <div key={rowIndex} role="row" className="contents">
            {wallpapers
              .slice(rowIndex * columns, (rowIndex + 1) * columns)
              .map((wallpaper, columnIndex) => {
                const index = rowIndex * columns + columnIndex
                return (
                  <WallpaperGridCardItem
                    key={wallpaper.id}
                    wallpaper={wallpaper}
                    selected={isSelected?.(wallpaper) ?? selectedId === wallpaper.id}
                    onClick={onCardClick}
                    compatibilityStatus={compatibilityMap?.[wallpaper.path ?? '']}
                    showCompatibilityDot={showCompatibilityDot}
                    glassClassName={glass}
                    overlay={renderCardOverlay?.(wallpaper)}
                    rowIndex={rowIndex}
                    columnIndex={columnIndex}
                    itemProps={getItemProps(itemIds[index], index)}
                  />
                )
              })}
          </div>
        ))}
      </div>
    </LayoutGroup>
  )
}
