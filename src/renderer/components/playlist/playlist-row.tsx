import { Clock, Shuffle, MoreVertical, Pencil, Trash2, Images } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselButtons,
  type CarouselApi,
} from '@/components/ui/carousel'
import type { Playlist } from '../../../shared/constants/playlist'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import { ApplyButton } from '@/components/wallpaper/apply-button'

interface PlaylistRowProps {
  playlist: Playlist
  wallpapers: Wallpaper[]
  isApplying: boolean
  activeScreens: string[]
  onApply: (screen?: string) => Promise<void>
  onStop: (screen?: string | string[]) => Promise<void>
  onEdit: () => void
  onDelete: () => void
  /**
   * Frosted-glass class, resolved once by the list via `useGlass()`. Passed
   * down so each row does not subscribe to the background state itself.
   */
  glassClassName?: string
}

export function PlaylistRow({
  playlist,
  wallpapers,
  isApplying,
  activeScreens,
  onApply,
  onStop,
  onEdit,
  onDelete,
  glassClassName,
}: PlaylistRowProps) {
  // Get wallpapers for this playlist
  const playlistWallpapers = playlist.items
    .map((path) => wallpapers.find((w) => w.path === path))
    .filter(Boolean) as Wallpaper[]

  // Translate vertical wheel/trackpad scroll into horizontal carousel movement
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()

  useEffect(() => {
    if (!carouselApi) return
    const root = carouselApi.rootNode()
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (delta === 0) return
      const forward = delta > 0
      if (forward ? carouselApi.canScrollNext() : carouselApi.canScrollPrev()) {
        event.preventDefault()
        if (forward) carouselApi.scrollNext()
        else carouselApi.scrollPrev()
      }
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [carouselApi])

  return (
    <div
      className={cn(
        'group border-border bg-card min-h-[200px] overflow-hidden rounded-xl border p-1 transition-all select-none',
        glassClassName,
      )}
    >
      {/* Header with info */}
      <div className="border-ring/30 flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="truncate text-xl font-bold tracking-tight">{playlist.name}</h3>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
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
            itemId={`playlist:${playlist.name}`}
            onApply={onApply}
            onStop={onStop}
            isApplying={isApplying}
            activeScreens={activeScreens}
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
                <Trash2 className="text-destructive size-4" />
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
          setApi={setCarouselApi}
          className="h-full w-full"
        >
          <CarouselContent className="-ml-3 gap-3 p-3">
            {playlistWallpapers.map((wallpaper) => (
              <CarouselItem key={wallpaper.path} className="basis-auto pl-3">
                <div className="ring-border/50 relative size-32 overflow-hidden rounded-lg ring-1 transition-all sm:size-36 md:size-40 lg:size-44 xl:size-48">
                  {activeScreens.length === 0 && (
                    <div className="from-card/40 via-card/10 to-card/10 absolute inset-0 z-10 bg-gradient-to-t transition-opacity duration-300 group-hover:opacity-0" />
                  )}

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
        <EmptyState className="-p-10 my-8" icon={Shuffle} title="No wallpapers found" />
      )}
    </div>
  )
}
