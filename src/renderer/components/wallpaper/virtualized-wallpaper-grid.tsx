import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { FolderOpen, type LucideIcon } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { WallpaperCard } from "./wallpaper-card"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"

const SKELETON_COUNT = 12
const GAP = 16 // matches gap-4 (1rem)
const MIN_CARD_WIDTH = 200 // target min card width; drives responsive column count
const MAX_COLS = 8
const OVERSCAN = 3

interface VirtualizedWallpaperGridProps {
    wallpapers: Wallpaper[]
    isLoading: boolean
    compatibilityMap?: Record<string, CompatibilityStatus>
    showCompatibilityDot?: boolean
    selectedId?: string
    onCardClick: (wallpaper: Wallpaper) => void
    emptyIcon?: LucideIcon
    emptyMessage?: string
    emptySubMessage?: string
}

/** Walk up the DOM to the nearest scrollable ancestor (the app-shell <main>). */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
    let el = node?.parentElement ?? null
    while (el) {
        const { overflowY } = getComputedStyle(el)
        if (overflowY === "auto" || overflowY === "scroll") return el
        el = el.parentElement
    }
    return null
}

export function VirtualizedWallpaperGrid({
    wallpapers,
    isLoading,
    compatibilityMap,
    showCompatibilityDot = true,
    selectedId,
    onCardClick,
    emptyIcon: EmptyIcon = FolderOpen,
    emptyMessage = "No wallpapers found",
    emptySubMessage,
}: VirtualizedWallpaperGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)
    const [width, setWidth] = useState(0)
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

    const columns = Math.min(
        MAX_COLS,
        Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP))),
    )
    const cardWidth = columns > 0 ? (width - GAP * (columns - 1)) / columns : 0
    const rowHeight = cardWidth + GAP // cards are square (aspect-square)
    const rowCount = Math.ceil(wallpapers.length / columns)

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollEl,
        estimateSize: () => rowHeight,
        overscan: OVERSCAN,
        scrollMargin,
    })

    // Re-measure rows when geometry changes (column count / width).
    useEffect(() => {
        virtualizer.measure()
    }, [virtualizer, columns, rowHeight])

    if (isLoading) {
        return (
            <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_CARD_WIDTH}px, 1fr))` }}
            >
                {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
            </div>
        )
    }

    if (wallpapers.length === 0) {
        return <EmptyState icon={EmptyIcon} title={emptyMessage} description={emptySubMessage} />
    }

    return (
        <div ref={parentRef}>
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
                                <WallpaperCard
                                    key={wallpaper.id}
                                    wallpaper={wallpaper}
                                    selected={selectedId === wallpaper.id}
                                    onClick={onCardClick}
                                    compatibilityStatus={compatibilityMap?.[wallpaper.path ?? ""]}
                                    showCompatibilityDot={showCompatibilityDot}
                                />
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
