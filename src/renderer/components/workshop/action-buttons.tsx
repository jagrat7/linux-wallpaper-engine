import { Button } from "@/components/ui/button"
import { Download, Trash2 } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { ApplyButton } from "../wallpaper/apply-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

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
    onStop: (screen?: string) => Promise<void>
    isApplying: boolean
    isActive: boolean
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
    isActive,
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
                isActive={isActive}
                className="flex-1"
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onUnsubscribe}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Unsubscribe</TooltipContent>
            </Tooltip>
        </div>
    )
}