import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { FolderOpen, type LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { WallpaperCard } from "./wallpaper-card"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"
import { DEFAULT_GRID_COLS } from "@/lib/utils"
import { useGlass } from "@/hooks/use-glass"
import { useWallpaperGridNavigation } from "@/hooks/use-wallpaper-grid-navigation"
import { cn } from "@/lib/utils"

const SKELETON_COUNT = 12

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
    gridClassName?: string
}

export function WallpaperGridLayout({
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
    gridClassName,
}: WallpaperGridLayoutProps) {
    const gridCols = DEFAULT_GRID_COLS
    const gridRef = useRef<HTMLDivElement>(null)
    const [columns, setColumns] = useState(1)
    // Resolved once for the whole grid — cards must not subscribe individually.
    const glass = useGlass()
    const itemIds = useMemo(
        () => wallpapers.map(wallpaper => wallpaper.path ?? wallpaper.id),
        [wallpapers],
    )
    const rowCount = Math.ceil(wallpapers.length / columns)
    const { getItemProps } = useWallpaperGridNavigation({ itemIds, columns })

    useLayoutEffect(() => {
        const node = gridRef.current
        if (!node) return

        const measure = () => {
            const template = getComputedStyle(node).gridTemplateColumns
            setColumns(Math.max(1, template.split(" ").filter(Boolean).length))
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    if (isLoading) {
        return (
            <div className={`grid gap-4 ${gridCols}`}>
                {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
                ))}
            </div>
        )
    }

    if (wallpapers.length === 0) {
        return <EmptyState icon={EmptyIcon} title={emptyMessage} description={emptySubMessage} />
    }

    return (
        <div
            ref={gridRef}
            role="grid"
            aria-label="Wallpapers"
            aria-rowcount={rowCount}
            aria-colcount={columns}
            className={cn("grid gap-4", gridClassName ?? gridCols)}
        >
            {Array.from({ length: rowCount }, (_, rowIndex) => (
                <div key={rowIndex} role="row" className="contents">
                    {wallpapers.slice(rowIndex * columns, (rowIndex + 1) * columns).map((wallpaper, columnIndex) => {
                        const index = rowIndex * columns + columnIndex
                        const id = itemIds[index]
                        const itemProps = getItemProps(id, index)

                        return (
                            <div
                                key={wallpaper.id}
                                role="gridcell"
                                aria-rowindex={rowIndex + 1}
                                aria-colindex={columnIndex + 1}
                                className="relative"
                                data-wallpaper-path={wallpaper.path}
                                data-wallpaper-id={wallpaper.id}
                            >
                                <WallpaperCard
                                    wallpaper={wallpaper}
                                    selected={isSelected?.(wallpaper) ?? selectedId === wallpaper.id}
                                    onClick={onCardClick}
                                    compatibilityStatus={compatibilityMap?.[wallpaper.path ?? ""]}
                                    showCompatibilityDot={showCompatibilityDot}
                                    glassClassName={glass}
                                    {...itemProps}
                                />
                                {renderCardOverlay?.(wallpaper)}
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}
