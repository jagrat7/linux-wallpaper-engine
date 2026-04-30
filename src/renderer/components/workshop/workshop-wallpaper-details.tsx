import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { WallpaperDetailsShell } from "../wallpaper/details-card/wallpaper-details"
import { WorkshopActionButtons } from "./action-buttons"
import { BackendNotInstalledDialog } from "@/components/wallpaper/backend-not-installed-dialog"
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE, type Wallpaper } from "../../../shared/constants/wallpaper"
import { useAtomValue, useSetAtom } from "jotai"
import {
    addUnsubscribedWorkshopIdAtom,
    removeUnsubscribedWorkshopIdAtom,
    unsubscribedWorkshopIdsAtom,
} from "@/contexts/atoms/workshop-atoms"

interface WorkshopWallpaperDetailsProps {
    wallpaper: Wallpaper
    onClose: () => void
}

export function WorkshopWallpaperDetails({ wallpaper, onClose }: WorkshopWallpaperDetailsProps) {
    const [isApplying, setIsApplying] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [showBackendDialog, setShowBackendDialog] = useState(false)
    const workshopId = wallpaper.workshopId ?? wallpaper.id
    const unsubscribedWorkshopIds = useAtomValue(unsubscribedWorkshopIdsAtom)
    const addUnsubscribedWorkshopId = useSetAtom(addUnsubscribedWorkshopIdAtom)
    const removeUnsubscribedWorkshopId = useSetAtom(removeUnsubscribedWorkshopIdAtom)
    const applyMutation = trpc.wallpaper.setWallpaper.useMutation()
    const stopMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const utils = trpc.useUtils()
    const isUnsubscribed = unsubscribedWorkshopIds.has(workshopId)

    const { data: workshopStatus } = trpc.workshop.status.useQuery(
        { workshopId },
        // Stop polling once unsubscribed — Steam keeps files until app close
        // so status would still return a path, but the user already unsubscribed.
        { refetchInterval: isDownloading ? 1000 : 3000, enabled: !isUnsubscribed },
    )

    const subscribeMutation = trpc.workshop.subscribe.useMutation({
        onSuccess: () => {
            removeUnsubscribedWorkshopId(workshopId)
            setIsDownloading(true)
        },
    })

    const unsubscribeMutation = trpc.workshop.unsubscribe.useMutation()

    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
    })

    // Treat as not installed when user has unsubscribed (files linger until app close)
    const wallpaperPath = isUnsubscribed ? null : (workshopStatus?.path ?? null)
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
        unsubscribeMutation.mutate({ workshopId }, {
            onSuccess: (didUnsubscribe) => {
                if (!didUnsubscribe) return

                // Steam only deletes files after the app closes, so we track
                // unsubscribed state locally to show the download button.
                addUnsubscribedWorkshopId(workshopId)
            },
        })
    }

    const handleApply = async (screen?: string) => {
        if (!wallpaperPath) return
        setIsApplying(true)
        try {
            const result = await applyMutation.mutateAsync({
                backgroundId: wallpaperPath,
                screen,
            })
            if (!result.success) {
                if (result.error === BACKEND_NOT_INSTALLED_ERROR_MESSAGE) {
                    setShowBackendDialog(true)
                    return
                }
            }

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
                    isUnsubscribing={unsubscribeMutation.isPending}
                    isActive={isActive}
                />
            }
        >
            <BackendNotInstalledDialog
                open={showBackendDialog}
                onOpenChange={setShowBackendDialog}
            />
        </WallpaperDetailsShell>
    )
}
