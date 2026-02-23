import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { FolderOpen, type LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { WallpaperCard } from "./wallpaper-card"
import type { Wallpaper } from "../../../shared/constants"
import type { CompatibilityStatus } from "../../../shared/constants"

const SKELETON_COUNT = 12
const DEFAULT_GRID_COLS = "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"

interface WallpaperGridLayoutProps {
    wallpapers: Wallpaper[]
    isLoading: boolean
    compatibilityMap?: Record<string, CompatibilityStatus>
    showCompatibilityDot?: boolean
    selectedId?: string
    onCardClick: (wallpaper: Wallpaper) => void
    gridClassName?: string
    emptyIcon?: LucideIcon
    emptyMessage?: string
    emptySubMessage?: string
    renderCardOverlay?: (wallpaper: Wallpaper) => ReactNode
}

export function WallpaperGridLayout({
    wallpapers,
    isLoading,
    compatibilityMap,
    showCompatibilityDot = true,
    selectedId,
    onCardClick,
    gridClassName,
    emptyIcon: EmptyIcon = FolderOpen,
    emptyMessage = "No wallpapers found",
    emptySubMessage,
    renderCardOverlay,
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
        return (
            <motion.div
                className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
            >
                <EmptyIcon className="size-12 mb-4 opacity-50" />
                <p className="font-medium">{emptyMessage}</p>
                {emptySubMessage && (
                    <p className="text-sm mt-1">{emptySubMessage}</p>
                )}
            </motion.div>
        )
    }

    return (
        <div className={`grid gap-4 ${gridCols}`}>
            {wallpapers.map((wallpaper) => (
                <div key={wallpaper.id} className="relative">
                    <WallpaperCard
                        wallpaper={wallpaper}
                        selected={selectedId === wallpaper.id}
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
