import { Square, Volume2, VolumeX, Monitor, ListVideo, Image } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"

// Single source of truth for the bar height; app-shell exposes it as --status-bar-h
export const STATUS_BAR_HEIGHT = "2.5rem"

interface StatusBarProps {
    className?: string
}

interface ScreenWallpaper {
    screen: string
    title: string
}

interface ScreenPlaylist {
    screen: string
    name: string
}

// Tooltip shown on the multi-screen badge, summarizing what runs where
function buildScreensTooltip(activeWallpapers: ScreenWallpaper[], activePlaylists: ScreenPlaylist[]): string {
    return activeWallpapers
        .map(({ screen, title }) => {
            const playlist = activePlaylists.find(entry => entry.screen === screen)
            return playlist ? `${screen}: ${title} (playlist: ${playlist.name})` : `${screen}: ${title}`
        })
        .join("\n")
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
    const navigate = useNavigate()

    // Get the primary display or first display
    const primaryDisplay = displays.find(d => d.primary) ?? displays[0]

    // Get the active wallpaper for the primary display
    const activeWallpaper = activeWallpapers.find(
        w => w.screen === primaryDisplay?.name
    ) ?? activeWallpapers[0]

    // Get the wallpaper title from the API response
    const wallpaperTitle = activeWallpaper?.title ?? 'Unknown'

    // Playlist driving the shown wallpaper's screen, if any
    const activePlaylist = activePlaylists.find(entry => entry.screen === activeWallpaper?.screen)

    const hasMultipleScreens = displays.length > 1
    const otherActiveCount = activeWallpapers.filter(w => w.screen !== activeWallpaper?.screen).length
    const screensTooltip = buildScreensTooltip(activeWallpapers, activePlaylists)

    const handleOpenDetails = () => {
        if (!activeWallpaper) return
        navigate({ to: "/", search: { wallpaper: activeWallpaper.wallpaper.backgroundId } })
    }

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
        <footer
            className={cn("flex items-center justify-between border-t border-border bg-sidebar px-4", className)}
            style={{ height: STATUS_BAR_HEIGHT }}
        >
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Monitor className="size-3.5" />
                    <span>{primaryDisplay?.name ?? "No Display"}</span>
                    {hasMultipleScreens && (
                        <span
                            className="rounded-full bg-secondary px-1.5 py-0.5 text-xs"
                            title={screensTooltip}
                        >
                            {activeWallpapers.length}/{displays.length} active
                        </span>
                    )}
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                    {activeWallpaper ? (
                        <>
                            <div className="size-2 rounded-full bg-success" />
                            {activePlaylist ? (
                                <span
                                    className="flex items-center gap-1 text-xs text-muted-foreground"
                                    title={`Playlist active: ${activePlaylist.name}`}
                                >
                                    <ListVideo className="size-3.5" />
                                    {activePlaylist.name}
                                </span>
                            ) : (
                                <Image className="size-3.5 text-muted-foreground" aria-label="Single wallpaper active" />
                            )}
                            <button
                                type="button"
                                onClick={handleOpenDetails}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                                title="Show wallpaper details"
                            >
                                {wallpaperTitle}
                            </button>
                            {otherActiveCount > 0 && (
                                <span
                                    className="text-xs text-muted-foreground/70"
                                    title={screensTooltip}
                                >
                                    +{otherActiveCount} more
                                </span>
                            )}
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
