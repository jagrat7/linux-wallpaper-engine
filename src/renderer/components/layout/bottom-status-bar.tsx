import { Square, Volume2, VolumeX, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"

interface StatusBarProps {
    className?: string
}

export function StatusBar({ className }: StatusBarProps) {
    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
        refetchOnMount: true,
    })

    const { data: displays = [] } = trpc.display.list.useQuery()
    const { data: settings } = trpc.settings.get.useQuery()
    const { data: activePlaylists = [] } = trpc.playlist.active.useQuery(undefined, {
        refetchInterval: 5000,
        refetchOnMount: true,
    })



    const stopMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const stopPlaylistMutation = trpc.playlist.stop.useMutation()
    const updateSettingsMutation = trpc.settings.update.useMutation()
    const utils = trpc.useUtils()

    // Get the primary display or first display
    const primaryDisplay = displays.find(d => d.primary) ?? displays[0]

    // Get the active wallpaper for the primary display
    const activeWallpaper = activeWallpapers.find(
        w => w.screen === primaryDisplay?.name
    ) ?? activeWallpapers[0]

    // Get the wallpaper title from the API response
    const wallpaperTitle = activeWallpaper?.title ?? 'Unknown'

    const handleStop = async () => {
        if (!activeWallpaper) return
        const activePlaylist = activePlaylists.find(entry => entry.screen === activeWallpaper.screen)
        if (activePlaylist) {
            await stopPlaylistMutation.mutateAsync({
                playlistName: activePlaylist.name,
                screen: activeWallpaper.screen,
            })
        } else {
            await stopMutation.mutateAsync({ screen: activeWallpaper.screen })
        }
        utils.wallpaper.getActiveWallpaper.invalidate()
        utils.playlist.active.invalidate()
    }

    const handleMuteToggle = async () => {
        if (!settings) return

        // Toggle between silent mode and normal volume
        await updateSettingsMutation.mutateAsync({
            silent: !settings.silent,
        })

        // Refresh settings to update UI
        utils.settings.get.invalidate()
    }

    return (
        <footer className={cn("flex h-10 items-center justify-between border-t border-border bg-sidebar px-4", className)}>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Monitor className="size-3.5" />
                    <span>{primaryDisplay?.name ?? "No Display"}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                    {activeWallpaper ? (
                        <>
                            <div className="size-2 rounded-full bg-success" />
                            <span className="text-sm text-muted-foreground">
                                {wallpaperTitle}
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="size-2 rounded-full bg-muted-foreground/50" />
                            <span className="text-sm text-muted-foreground">
                                No active wallpaper
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    onClick={handleMuteToggle}
                    disabled={!activeWallpaper || !settings}
                    title={settings?.silent ? "Unmute" : "Mute"}
                >
                    {settings?.silent ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    onClick={handleStop}
                    disabled={!activeWallpaper}
                    title="Stop wallpaper"
                >
                    <Square className="size-3.5" />
                </Button>
            </div>
        </footer>
    )
}
