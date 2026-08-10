import { type ReactNode } from "react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useGlass } from "@/hooks/use-glass"
import { type Wallpaper } from "../wallpaper-card"
import { WallpaperThumbnail } from "../wallpaper-thumbnail"
import { WallpaperMetadata } from "./wallpaper-metadata"
import { WallpaperTags } from "./wallpaper-tags"
import { KEYBOARD_SHORTCUTS } from "@/lib/keyboard-shortcuts"

interface WallpaperDetailsShellProps {
    wallpaper: Wallpaper
    onClose: () => void
    actions: ReactNode
    children?: ReactNode
}

export function WallpaperDetailsShell({ wallpaper, onClose, actions, children }: WallpaperDetailsShellProps) {
    const glass = useGlass()

    useHotkey(KEYBOARD_SHORTCUTS.closeDetails.hotkey, () => {
        if (!document.querySelector('[role="dialog"][data-state="open"]')) onClose()
    }, {
        ignoreInputs: false,
        preventDefault: true,
        stopPropagation: true,
        conflictBehavior: "replace",
        meta: {
            name: KEYBOARD_SHORTCUTS.closeDetails.label,
            description: KEYBOARD_SHORTCUTS.closeDetails.description,
        },
    })

    return (
        <div id="wallpaper-details" className={cn("sticky top-0 max-h-[calc(100vh_-_var(--status-bar-h,0rem)_-_2rem)] w-80 shrink-0 overflow-y-auto rounded-xl border border-border bg-card scrollbar-thin", glass)}>
            <div className="sticky top-2 z-10 flex justify-end pr-2 h-0">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={onClose}
                    aria-label={`Close details for ${wallpaper.title}`}
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
