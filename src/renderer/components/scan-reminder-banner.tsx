import { Link } from "@tanstack/react-router"
import { ScanSearch, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"

export function ScanReminderBanner() {
    const { data: settings } = trpc.settings.get.useQuery()
    const utils = trpc.useUtils()
    const updateSettings = trpc.settings.update.useMutation({
        onSuccess: () => utils.settings.get.invalidate(),
    })

    if (!settings || settings.dismissedScanReminder) {
        return null
    }

    const handleDismiss = () => {
        updateSettings.mutate({ dismissedScanReminder: true })
    }

    return (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
            <div className="flex items-center gap-3">
                <ScanSearch className="size-5 shrink-0 text-warning" />
                <p className="text-sm text-warning/80">
                    <span className="font-medium">Recommended:</span> Scan your wallpapers
                    for Linux compatibility.{" "}
                    <Link
                        to="/settings"
                        className="font-medium underline underline-offset-2 transition-colors hover:text-warning"
                    >
                        Go to Settings
                    </Link>
                </p>
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="shrink-0 text-warning hover:bg-warning/20 hover:text-warning/80"
            >
                <X className="size-4" />
            </Button>
        </div>
    )
}
