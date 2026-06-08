import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { WallpaperDetailsShell } from "../wallpaper/details-card/wallpaper-details"
import { WorkshopActionButtons } from "./action-buttons"
import { BackendNotInstalledDialog } from "@/components/wallpaper/backend-not-installed-dialog"
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE, WALLPAPER_APPLY_FAILED_MESSAGE, type Wallpaper } from "../../../shared/constants/wallpaper"
import { ErrorMessage } from "@/components/error-message"
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
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

    const activeScreens = activeWallpapers
        .filter(w => w.wallpaper.backgroundId === wallpaperPath)
        .map(w => w.screen)

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
        setErrorMessage(null)
        try {
            const result = await applyMutation.mutateAsync({
                backgroundId: wallpaperPath,
                screen,
            })
            // Clear applying state in the same tick as any error update so the
            // button and error message stay in sync.
            setIsApplying(false)
            if (!result.success) {
                if (result.error === BACKEND_NOT_INSTALLED_ERROR_MESSAGE) {
                    setShowBackendDialog(true)
                    return
                }
                setErrorMessage(WALLPAPER_APPLY_FAILED_MESSAGE)
            }

            await utils.wallpaper.getActiveWallpaper.invalidate()
            await utils.playlist.active.invalidate()
        } catch {
            setIsApplying(false)
            setErrorMessage(WALLPAPER_APPLY_FAILED_MESSAGE)
        }
    }

    const handleStop = async (screen?: string | string[]) => {
        const screens = Array.isArray(screen) ? screen : [screen]
        await Promise.all(screens.map(screen => stopMutation.mutateAsync({ screen })))
        await utils.wallpaper.getActiveWallpaper.invalidate()
        await utils.playlist.active.invalidate()
    }

    return (
        <WallpaperDetailsShell
            wallpaper={wallpaper}
            onClose={onClose}
            actions={
                <>
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
                        activeScreens={activeScreens}
                    />
                    <ErrorMessage
                        message={errorMessage}
                        setMessage={setErrorMessage}
                        className="mt-2 bg-destructive/10"
                    />
                </>
            }
        >
            <BackendNotInstalledDialog
                open={showBackendDialog}
                onOpenChange={setShowBackendDialog}
            />
        </WallpaperDetailsShell>
    )
}
