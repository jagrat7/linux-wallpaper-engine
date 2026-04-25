import { useState } from "react"
import { type Wallpaper } from "../wallpaper-card"
import { WallpaperOverrides } from "../wallpaper-overrides"
import { trpc } from "@/lib/trpc"
import { ApplyButton } from "../apply-button"
import { DebugLogDialog } from "../debug-log-dialog"
import { WallpaperDetailsShell } from "./wallpaper-details-shell"
import { CompatibilitySection } from "./compatibility-section"
import { ErrorMessage } from "@/components/error-message"
import { UnsubscribeButton } from "@/components/workshop/unsubscribe-button"
import { useSetAtom } from "jotai"
import { addUnsubscribedWorkshopIdAtom } from "@/contexts/atoms/workshop-atoms"

export { WallpaperDetailsShell } from "./wallpaper-details-shell"
export { WallpaperMetadata } from "./wallpaper-metadata"
export { WallpaperTags } from "./wallpaper-tags"

interface WallpaperDetailsProps {
    wallpaper: Wallpaper
    onClose: () => void
    onUnsubscribe?: () => void
}

export function WallpaperDetails({ wallpaper, onClose, onUnsubscribe }: WallpaperDetailsProps) {
    const [isApplying, setIsApplying] = useState(false)
    const [isUnsubscribing, setIsUnsubscribing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [debugScreen, setDebugScreen] = useState<string | null>(null)
    const workshopId = wallpaper.workshopId ?? wallpaper.id
    const canUnsubscribe = !!wallpaper.workshopId
    const addUnsubscribedWorkshopId = useSetAtom(addUnsubscribedWorkshopIdAtom)
    const applyMutation = trpc.wallpaper.setWallpaper.useMutation()
    const stopMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const unsubscribeMutation = trpc.workshop.unsubscribe.useMutation()
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

    const handleUnsubscribe = async () => {
        if (!canUnsubscribe) return
        setIsUnsubscribing(true)
        setErrorMessage(null)
        try {
            const didUnsubscribe = await unsubscribeMutation.mutateAsync({ workshopId })

            if (!didUnsubscribe) {
                setErrorMessage("Steam is not connected. Start Steam and log in, then try again.")
                return
            }

            addUnsubscribedWorkshopId(workshopId)
            onUnsubscribe?.()
        } catch {
            setErrorMessage("Steam is not connected. Start Steam and log in, then try again.")
        } finally {
            setIsUnsubscribing(false)
        }
    }

    return (
        <WallpaperDetailsShell
            wallpaper={wallpaper}
            onClose={onClose}
            actions={
                <>
                    <div className="flex items-center gap-2">
                        <ApplyButton
                            onApply={handleApply}
                            onStop={handleStop}
                            isApplying={isApplying}
                            isActive={isActive}
                            className="flex-1"
                        />
                        {canUnsubscribe && (
                            <UnsubscribeButton
                                onClick={handleUnsubscribe}
                                disabled={isUnsubscribing}
                            />
                        )}
                    </div>
                    <ErrorMessage
                        message={errorMessage}
                        setMessage={setErrorMessage}
                        className="mt-2 bg-destructive/10"
                    />
                </>
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
