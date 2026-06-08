import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { ApplyButton } from "../wallpaper/apply-button"
import { UnsubscribeButton } from "./unsubscribe-button"

type DownloadProgress = {
    current: number
    total: number
}

interface WorkshopActionButtonsProps {
    wallpaperPath: string | null
    downloadProgress: DownloadProgress | null
    isDownloading: boolean
    onDownload: () => void
    onUnsubscribe: () => void
    onApply: (screen?: string) => Promise<void>
    onStop: (screen?: string | string[]) => Promise<void>
    isApplying: boolean
    isUnsubscribing?: boolean
    activeScreens?: string[]
}

export function WorkshopActionButtons({
    wallpaperPath,
    downloadProgress,
    isDownloading,
    onDownload,
    onUnsubscribe,
    onApply,
    onStop,
    isApplying,
    isUnsubscribing = false,
    activeScreens,
}: WorkshopActionButtonsProps) {
    const isSubscribed = wallpaperPath != null

    if (isDownloading) {
        const percent = downloadProgress?.total
            ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
            : 0

        return (
            <LoadingButton isLoading variant="default" className="w-full" loadingText={`Downloading ${percent}%`}>
                Download
            </LoadingButton>
        )
    }

    if (!isSubscribed) {
        return (
            <Button
                className="w-full gap-2"
                onClick={onDownload}
            >
                <Download className="size-4" />
                Download
            </Button>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <ApplyButton
                onApply={onApply}
                onStop={onStop}
                isApplying={isApplying}
                activeScreens={activeScreens}
                className="flex-1"
            />
            <UnsubscribeButton onClick={onUnsubscribe} disabled={isUnsubscribing} />
        </div>
    )
}
