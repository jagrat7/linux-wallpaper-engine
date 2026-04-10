import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { WallpaperDetailsShell } from "../wallpaper/wallpaper-details"
import { WorkshopActionButtons } from "./action-buttons"
import type { Wallpaper } from "../../../shared/constants/wallpaper"



interface WorkshopWallpaperDetailsProps {
    wallpaper: Wallpaper
    onClose: () => void
}

export function WorkshopWallpaperDetails({ wallpaper, onClose }: WorkshopWallpaperDetailsProps) {
    const [isApplying, setIsApplying] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [unsubscribed, setUnsubscribed] = useState(false)
    const workshopId = wallpaper.workshopId ?? wallpaper.id
    const applyMutation = trpc.wallpaper.setWallpaper.useMutation()
    const stopMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const utils = trpc.useUtils()

    const { data: workshopStatus } = trpc.workshop.status.useQuery(
        { workshopId },
        // Stop polling once unsubscribed — Steam keeps files until app close
        // so status would still return a path, but the user already unsubscribed.
        { refetchInterval: isDownloading ? 1000 : 3000, enabled: !unsubscribed },
    )

    const subscribeMutation = trpc.workshop.subscribe.useMutation({
        onSuccess: () => {
            setUnsubscribed(false)
            setIsDownloading(true)
        },
    })

    const unsubscribeMutation = trpc.workshop.unsubscribe.useMutation({
        onSuccess: () => {
            // Steam only deletes files after the app closes, so we track
            // unsubscribed state locally to show the download button.
            setUnsubscribed(true)
        },
    })

    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
    })

    // Treat as not installed when user has unsubscribed (files linger until app close)
    const wallpaperPath = unsubscribed ? null : (workshopStatus?.path ?? null)
    const downloadProgress = workshopStatus?.download ?? null

    // When status reports a path while downloading, the download is complete
    useEffect(() => {
        if (isDownloading && wallpaperPath) {
            setIsDownloading(false)
        }
    }, [isDownloading, wallpaperPath])

    const isActive = activeWallpapers.some(
        w => w.wallpaper.backgroundId === wallpaperPath
    )

    const handleDownload = () => {
        subscribeMutation.mutate({ workshopId })
    }

    const handleUnsubscribe = () => {
        unsubscribeMutation.mutate({ workshopId })
    }

    const handleApply = async (screen?: string) => {
        if (!wallpaperPath) return
        setIsApplying(true)
        try {
            await applyMutation.mutateAsync({
                backgroundId: wallpaperPath,
                screen,
            })
            await utils.wallpaper.getActiveWallpaper.invalidate()
            await utils.playlist.active.invalidate()
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
                <WorkshopActionButtons
                    wallpaperPath={wallpaperPath}
                    downloadProgress={downloadProgress}
                    isDownloading={isDownloading}
                    onDownload={handleDownload}
                    onUnsubscribe={handleUnsubscribe}
                    onApply={handleApply}
                    onStop={handleStop}
                    isApplying={isApplying}
                    isActive={isActive}
                />
            }
        />
    )
}
