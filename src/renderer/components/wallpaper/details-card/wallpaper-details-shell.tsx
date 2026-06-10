import { type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type Wallpaper } from "../wallpaper-card"
import { WallpaperThumbnail } from "../wallpaper-thumbnail"
import { WallpaperMetadata } from "./wallpaper-metadata"
import { WallpaperTags } from "./wallpaper-tags"

interface WallpaperDetailsShellProps {
    wallpaper: Wallpaper
    onClose: () => void
    actions: ReactNode
    children?: ReactNode
}

export function WallpaperDetailsShell({ wallpaper, onClose, actions, children }: WallpaperDetailsShellProps) {
    return (
        <div id="wallpaper-details" className="sticky top-0 max-h-[95vh] w-80 shrink-0 overflow-y-auto rounded-xl border border-border bg-card glass scrollbar-thin ">
            <div className="sticky top-2 z-10 flex justify-end pr-2 h-0">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>

            <WallpaperThumbnail
                src={wallpaper.thumbnail}
                alt={wallpaper.title}
                containerClassName="rounded-t-xl"
            />

            <div className="p-4">
                <h2 className="text-lg font-semibold">{wallpaper.title}</h2>
                <p className="text-sm text-muted-foreground">by {wallpaper.author}</p>

                <div className="mt-4">
                    {actions}
                </div>

                <WallpaperMetadata wallpaper={wallpaper} />
                <WallpaperTags tags={wallpaper.tags} />
                {children}
            </div>
        </div>
    )
}
