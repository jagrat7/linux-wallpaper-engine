import { type ReactNode } from "react"
import { FolderOpen, type LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { WallpaperCard } from "./wallpaper-card"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { CompatibilityStatus } from "../../../shared/constants/compatibility"
import { DEFAULT_GRID_COLS } from "@/lib/utils"

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
    const gridCols = gridClassName ?? DEFAULT_GRID_COLS

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
        <div className={`grid gap-4 ${gridCols}`}>
            {wallpapers.map((wallpaper) => (
                <div key={wallpaper.id} className="relative" data-wallpaper-path={wallpaper.path}>
                    <WallpaperCard
                        wallpaper={wallpaper}
                        selected={isSelected?.(wallpaper) ?? selectedId === wallpaper.id}
                        onClick={onCardClick}
                        compatibilityStatus={compatibilityMap?.[wallpaper.path ?? ""]}
                        showCompatibilityDot={showCompatibilityDot}
                    />
                    {renderCardOverlay?.(wallpaper)}
                </div>
            ))}
        </div>
    )
}
