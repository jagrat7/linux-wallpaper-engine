import { Link } from "@tanstack/react-router"
import { ScanSearch } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { ReminderBanner, reminderBannerLinkClass } from "@/components/reminder-banner"

export function ScanReminderBanner() {
    const { data: settings } = trpc.settings.get.useQuery()
    const utils = trpc.useUtils()
    const updateSettings = trpc.settings.update.useMutation({
        onSuccess: () => utils.settings.get.invalidate(),
    })

    if (!settings || settings.dismissedScanReminder) return null

    return (
        <ReminderBanner
            variant="warning"
            icon={<ScanSearch />}
            onDismiss={() => updateSettings.mutate({ dismissedScanReminder: true })}
        >
            <span className="font-medium">Recommended:</span> Scan your wallpapers for Linux compatibility.{" "}
            <Link
                to="/settings"
                className={`font-medium underline underline-offset-2 transition-colors ${reminderBannerLinkClass.warning}`}
            >
                Go to Settings
            </Link>
        </ReminderBanner>
    )
}
