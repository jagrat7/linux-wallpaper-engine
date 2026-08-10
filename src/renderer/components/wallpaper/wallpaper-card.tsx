import { memo } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { WallpaperThumbnail } from "./wallpaper-thumbnail"
import { COMPATIBILITY_CONFIG, type CompatibilityStatus } from "../../../shared/constants/compatibility"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

export type { Wallpaper }

interface WallpaperCardProps {
    wallpaper: Wallpaper
    onClick?: (wallpaper: Wallpaper) => void
    selected?: boolean
    compatibilityStatus?: CompatibilityStatus
    showCompatibilityDot?: boolean
    /**
     * Frosted-glass class, resolved by the grid via `useGlass()`. Passed down so
     * a grid of cards costs zero extra queries per item.
     */
    glassClassName?: string
}


export const WallpaperCard = memo(function WallpaperCard({
    wallpaper,
    onClick,
    selected,
    compatibilityStatus,
    showCompatibilityDot = true,
    glassClassName,
}: WallpaperCardProps) {

    return (
        <div
            className={cn(
                "cv-auto group relative overflow-hidden rounded-xl border bg-card transition-all duration-200",
                glassClassName,
                selected
                    ? "!border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-ring/50 hover:shadow-lg"
            )}
        >
            <WallpaperThumbnail
                src={wallpaper.thumbnail}
                alt={wallpaper.title}
                enableHover={true}
            >
                {/* Gradient overlay at bottom */}
                {/* Gradient overlay with smooth fade and blur */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/60 to-transparent" />

                {/* Title Overlay */}
                <div className="absolute bottom-0 left-0 w-full p-2">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight drop-shadow-md">
                        {wallpaper.title}
                    </h3>
                </div>

                {showCompatibilityDot && compatibilityStatus && compatibilityStatus !== 'unknown' && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "absolute top-2 right-2 z-20 size-2.5 rounded-full ring-1 ring-black/20",
                                COMPATIBILITY_CONFIG[compatibilityStatus].bgColor
                            )}
                                aria-hidden="true"
                            />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                            {COMPATIBILITY_CONFIG[compatibilityStatus].label}
                        </TooltipContent>
                    </Tooltip>
                )}
            </WallpaperThumbnail>
            <button
                type="button"
                aria-label={`${wallpaper.title}${showCompatibilityDot && compatibilityStatus && compatibilityStatus !== "unknown" ? `, ${COMPATIBILITY_CONFIG[compatibilityStatus].label}` : ""}`}
                className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onClick?.(wallpaper)}
            />
        </div>
    )
})
