import { useState } from "react"
import { type Wallpaper } from "../wallpaper-card"
import { WallpaperOverrides } from "../wallpaper-overrides"
import { trpc } from "@/lib/trpc"
import { ApplyButton } from "../apply-button"
import { DebugLogDialog } from "../debug-log-dialog"
import { WallpaperDetailsShell } from "./wallpaper-details-shell"
import { CompatibilitySection } from "./compatibility-section"

export { WallpaperDetailsShell } from "./wallpaper-details-shell"
export { WallpaperMetadata } from "./wallpaper-metadata"
export { WallpaperTags } from "./wallpaper-tags"

interface WallpaperDetailsProps {
    wallpaper: Wallpaper
    onClose: () => void
}

export function WallpaperDetails({ wallpaper, onClose }: WallpaperDetailsProps) {
    const [isApplying, setIsApplying] = useState(false)
    const [debugScreen, setDebugScreen] = useState<string | null>(null)
    const applyMutation = trpc.wallpaper.setWallpaper.useMutation()
    const stopMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const utils = trpc.useUtils()

    const { data: settings } = trpc.settings.get.useQuery()

    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
    })

    const isActive = activeWallpapers.some(
        w => w.wallpaper.backgroundId === (wallpaper.path ?? wallpaper.id)
    )

    const handleApply = async (screen?: string) => {
        if (!wallpaper.path && !wallpaper.id) return
        setIsApplying(true)
        try {
            const result = await applyMutation.mutateAsync({
                backgroundId: wallpaper.path ?? wallpaper.id,
                screen,
            })
            await utils.wallpaper.getActiveWallpaper.invalidate()
            await utils.playlist.active.invalidate()

            if (settings?.debugMode && result.success) {
                const displays = utils.display.list.getData()
                const primary = displays?.find(d => d.primary) ?? displays?.[0]
                setDebugScreen(screen ?? primary?.name ?? 'default')
            }
        } finally {
            setIsApplying(false)
        }
    }

    const handleStop = async (screen?: string) => {
        await stopMutation.mutateAsync({ screen })
        await utils.wallpaper.getActiveWallpaper.invalidate()
        await utils.playlist.active.invalidate()
    }

    return (
        <WallpaperDetailsShell
            wallpaper={wallpaper}
            onClose={onClose}
            actions={
                <ApplyButton
                    onApply={handleApply}
                    onStop={handleStop}
                    isApplying={isApplying}
                    isActive={isActive}
                    className="w-full"
                />
            }
        >
            {debugScreen && (
                <DebugLogDialog
                    open={!!debugScreen}
                    onClose={() => setDebugScreen(null)}
                    screen={debugScreen}
                />
            )}

            <CompatibilitySection wallpaperPath={wallpaper.path ?? ''} />
            <WallpaperOverrides wallpaper={wallpaper} />
        </WallpaperDetailsShell>
    )
}
