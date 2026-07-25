import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { FolderOpen, type LucideIcon } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { WallpaperCard } from "./wallpaper-card"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"
import { findScrollParent, DEFAULT_GRID_COLS, columnsForWidth } from "@/lib/utils"
import { useGlass } from "@/hooks/use-glass"

const GAP = 16 // matches gap-4 (1rem)
const OVERSCAN = 3 // rows rendered beyond the viewport to smooth scrolling

export interface VirtualizedWallpaperGridHandle {
    /** Scroll the row containing the given wallpaper path into view. */
    scrollToPath: (path: string) => void
}

interface VirtualizedWallpaperGridProps {
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
    ref?: Ref<VirtualizedWallpaperGridHandle>
}



export function VirtualizedWallpaperGrid({
    wallpapers,
    isLoading,
    compatibilityMap,
    showCompatibilityDot = true,
    selectedId,
    isSelected,
    onCardClick,
    emptyIcon: EmptyIcon = FolderOpen,
    emptyMessage = "No wallpapers found",
    emptySubMessage,
    renderCardOverlay,
    ref,
}: VirtualizedWallpaperGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    // Resolved once for the whole grid — cards must not subscribe individually.
    const glass = useGlass()
    const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)
    const [width, setWidth] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [scrollMargin, setScrollMargin] = useState(0)

    // Resolve the scroll container once mounted.
    useLayoutEffect(() => {
        setScrollEl(findScrollParent(parentRef.current))
    }, [])

    // Track container width (drives column count) and the list's offset within the
    // scroll element (scrollMargin) so rows position correctly below the banner.
    useLayoutEffect(() => {
        const node = parentRef.current
        if (!node) return

        const measure = () => {
            setWidth(node.clientWidth)
            if (scrollEl) {
                setViewportHeight(scrollEl.clientHeight)
                const parentRect = node.getBoundingClientRect()
                const scrollRect = scrollEl.getBoundingClientRect()
                setScrollMargin(scrollEl.scrollTop + parentRect.top - scrollRect.top)
            }
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [scrollEl])

    // Breakpoints are applied to the container width (not the viewport), so the
    // column count adapts when side panels narrow the grid.
    const columns = columnsForWidth(width)
    const cardWidth = columns > 0 ? (width - GAP * (columns - 1)) / columns : 0
    const rowHeight = cardWidth + GAP // cards are square (aspect-square)
    const rowCount = Math.ceil(wallpapers.length / columns)

    // Fill the visible viewport with skeletons rather than a fixed count.
    const skeletonRows = rowHeight > 0 ? Math.ceil((viewportHeight || rowHeight * 3) / rowHeight) : 3
    const skeletonCount = columns * skeletonRows

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollEl,
        estimateSize: () => rowHeight,
        overscan: OVERSCAN,
        scrollMargin,
    })

    // Re-measure rows when geometry changes (column count / width).
    useLayoutEffect(() => {
        virtualizer.measure()
    }, [virtualizer, columns, rowHeight])

    useImperativeHandle(ref, () => ({
        scrollToPath: (path: string) => {
            const index = wallpapers.findIndex(w => w.path === path)
            if (index < 0 || columns === 0) return
            virtualizer.scrollToIndex(Math.floor(index / columns), {
                align: "center",
                behavior: "auto",
            })
        },
    }), [virtualizer, wallpapers, columns])

    const skeleton = (
        <div className={`grid gap-4 ${DEFAULT_GRID_COLS}`}>
            {Array.from({ length: skeletonCount }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
        </div>
    )

    const rows = (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const start = virtualRow.index * columns
                const rowItems = wallpapers.slice(start, start + columns)
                return (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="grid gap-4"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                            paddingBottom: GAP,
                        }}
                    >
                        {rowItems.map((wallpaper) => (
                            <div key={wallpaper.id} className="relative" data-wallpaper-path={wallpaper.path}>
                                <WallpaperCard
                                    wallpaper={wallpaper}
                                    selected={isSelected?.(wallpaper) ?? selectedId === wallpaper.id}
                                    onClick={onCardClick}
                                    compatibilityStatus={compatibilityMap?.[wallpaper.path ?? ""]}
                                    showCompatibilityDot={showCompatibilityDot}
                                    glassClassName={glass}
                                />
                                {renderCardOverlay?.(wallpaper)}
                            </div>
                        ))}
                    </div>
                )
            })}
        </div>
    )

    // The parentRef div is now always mounted so the layout effects above can
    // resolve the scroll parent and attach the ResizeObserver on first mount.
    return (
        <div ref={parentRef}>
            {isLoading ? (
                skeleton
            ) : wallpapers.length === 0 ? (
                <EmptyState icon={EmptyIcon} title={emptyMessage} description={emptySubMessage} />
            ) : (
                rows
            )}
        </div>
    )
}
