import { createFileRoute } from "@tanstack/react-router"
import { Monitor, Plus, Loader2, AlertCircle, Info } from "lucide-react"
import { WallpaperThumbnail } from "@/components/wallpaper/wallpaper-thumbnail"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc"
import { useMemo } from "react"

export const Route = createFileRoute("/displays")({
    component: DisplaysPage,
})

interface DisplayMonitor {
    id: string
    name: string
    resolution: string
    position: { x: number; y: number }
    wallpaper: { name: string; thumbnail: string } | null
    scaling: "fill" | "stretch" | "fit" | "default"
}

function DisplaysPage() {
    // Fetch displays from backend
    const { data: displays, isLoading, error } = trpc.display.list.useQuery()
    const { data: session } = trpc.display.session.useQuery()
    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
    })

    // Transform backend displays to our monitor format
    const monitors: DisplayMonitor[] = useMemo(() => {
        if (!displays) return []
        return displays.map((d) => {
            // Find active wallpaper for this display
            const active = activeWallpapers.find(w => w.screen === d.name)
            return {
                id: d.name,
                name: d.name,
                resolution: d.resolution,
                position: { x: d.x, y: d.y },
                wallpaper: active ? {
                    name: active.title ?? 'Unknown',
                    thumbnail: active.thumbnail ? `local-file://${active.thumbnail}` : '',
                } : null,
                scaling: (active?.wallpaper.scaling ?? "default") as DisplayMonitor["scaling"],
            }
        })
    }, [displays, activeWallpapers])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground glass">
                <Loader2 className="size-8 animate-spin mb-4" />
                <p>Detecting displays...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-destructive glass">
                <AlertCircle className="size-8 mb-4" />
                <p className="font-medium">Failed to detect displays</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </div>
        )
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Displays"
                description="View wallpapers for each monitor"
                action={
                    session ? (
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                            {session.type.toUpperCase()}
                        </span>
                    ) : undefined
                }
            />

            <div id="onboarding-display-layout" className="mb-8 min-h-[200px] md:min-h-[300px] lg:min-h-[400px] xl:min-h-[450px] rounded-xl border border-border bg-card p-6 glass">
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                    Monitor Layout
                </h2>
                <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 py-8 md:py-12 lg:py-16">
                    {monitors.length === 0 ? (
                        <div className="text-center text-muted-foreground">
                            <Monitor className="size-12 mx-auto mb-2 opacity-50" />
                            <p>No displays detected</p>
                        </div>
                    ) : (
                        monitors.map((monitor) => (
                            <div
                                key={monitor.id}
                                className="group relative aspect-video overflow-hidden rounded-lg border-2 border-border bg-secondary/50 transition-all hover:border-ring
                                    w-36 sm:w-44 md:w-56 lg:w-72 xl:w-80"
                            >
                                {monitor.wallpaper ? (
                                    <WallpaperThumbnail
                                        src={monitor.wallpaper.thumbnail}
                                        alt={monitor.wallpaper.name}
                                        containerClassName="aspect-auto size-full"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">
                                        <Plus className="size-8 text-muted-foreground/50" />
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                    <p className="text-xs font-medium text-white">{monitor.id}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div id="onboarding-display-settings" className="space-y-4">
                <h2 className="text-lg font-semibold">Display Settings</h2>
                {monitors.map((monitor) => (
                    <div
                        key={monitor.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-4 glass"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                                <Monitor className="size-5 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">{monitor.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {monitor.id} - {monitor.resolution}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm font-medium">
                                    {monitor.wallpaper?.name ?? "No wallpaper"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Scaling: {monitor.scaling}
                                </p>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex size-8 cursor-help items-center justify-center rounded-md text-muted-foreground ">
                                            <Info className="size-4" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-sm">
                                            Select a wallpaper from the gallery to apply it here. Use per-wallpaper settings to customize settings for each wallpaper.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
