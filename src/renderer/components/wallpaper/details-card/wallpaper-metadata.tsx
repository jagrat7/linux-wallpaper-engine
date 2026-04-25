import {
    HardDrive,
    Layers,
    Monitor,
} from "lucide-react"
import { type Wallpaper } from "../wallpaper-card"
import { formatFileSize } from "@/lib/utils"
import { WALLPAPER_TYPE_LABELS } from "../../../../shared/constants/wallpaper"

export function WallpaperMetadata({ wallpaper }: { wallpaper: Wallpaper }) {
    return (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="size-4" />
                    Type
                </span>
                <span>{WALLPAPER_TYPE_LABELS[wallpaper.type]}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                    <Monitor className="size-4" />
                    Resolution
                </span>
                <span>
                    {wallpaper.resolution.width > 0 && wallpaper.resolution.height > 0
                        ? `${wallpaper.resolution.width}x${wallpaper.resolution.height}`
                        : "N/A"}
                </span>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="size-4" />
                    Size
                </span>
                <span>{formatFileSize(wallpaper.fileSize)}</span>
            </div>
        </div>
    )
}
