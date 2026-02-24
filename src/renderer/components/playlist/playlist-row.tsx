import { Clock, Shuffle, MoreVertical, Pencil, Trash2, Images, CircleCheck } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselButtons,
} from "@/components/ui/carousel"
import { type Playlist, type Wallpaper } from "../../../shared/constants"
import { ApplyButton } from "@/components/wallpaper/apply-button"

interface PlaylistRowProps {
    playlist: Playlist
    wallpapers: Wallpaper[]
    isApplying: boolean
    isActive: boolean
    onApply: (screen?: string) => Promise<void>
    onStop: (screen?: string) => Promise<void>
    onEdit: () => void
    onDelete: () => void
}

export function PlaylistRow({
    playlist,
    wallpapers,
    isApplying,
    isActive,
    onApply,
    onStop,
    onEdit,
    onDelete,
}: PlaylistRowProps) {
    // Get wallpapers for this playlist
    const playlistWallpapers = playlist.items
        .map(path => wallpapers.find(w => w.path === path))
        .filter(Boolean) as Wallpaper[]

    return (
        <div className={cn(
            "group glass p-1 rounded-xl min-h-[200px] transition-all overflow-hidden"
        )}>
            {/* Header with info */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-ring/30">
                <div className="flex flex-col gap-1.5 min-w-0">
                    <h3 className="font-bold truncate text-xl tracking-tight">{playlist.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium">
                            <Images className="size-3.5" />
                            {playlist.items.length}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {playlist.settings.delay}m
                        </span>
                        {playlist.settings.order === 'random' && (
                            <span className="flex items-center gap-1">
                                <Shuffle className="size-3" />
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Apply / Stop button */}
                    <ApplyButton
                        onApply={onApply}
                        onStop={onStop}
                        isApplying={isApplying}
                        isActive={isActive}
                        size="sm"
                    />

                    {/* Actions menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" className="size-8">
                                <MoreVertical className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Pencil className="size-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive hover:text-destructive"
                                onClick={onDelete}
                            >
                                <Trash2 className="size-4 text-destructive" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Wallpaper carousel */}
            {playlistWallpapers.length > 0 ? (
                <Carousel
                    opts={{
                        align: 'start',
                        loop: false,
                        dragFree: true,
                    }}
                    className="w-full h-full"
                >
                    <CarouselContent className="p-3 -ml-3 gap-3">
                        {playlistWallpapers.map((wallpaper) => (
                            <CarouselItem
                                key={wallpaper.path}
                                className="pl-3 basis-auto"
                            >

                                <div className="relative size-32 sm:size-36 md:size-40 lg:size-44 xl:size-48 rounded-lg overflow-hidden ring-1 ring-border/50 transition-all">
                                    {!isActive && <div className="absolute inset-0 bg-gradient-to-t from-card/40 via-card/10 to-card/10 transition-opacity duration-300 group-hover:opacity-0 z-10" />}

                                    <img
                                        src={`local-file://${wallpaper.thumbnail ?? wallpaper.path}`}
                                        alt={wallpaper.title ?? wallpaper.path.split('/').pop() ?? 'Wallpaper'}
                                        className="size-full object-cover"
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselButtons />
                </Carousel>
            ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Shuffle className="size-8 opacity-50" />
                </div>
            )}
        </div>
    )
}
