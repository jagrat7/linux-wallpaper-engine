import { ArrowUpCircle } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { ReminderBanner, reminderBannerLinkClass } from "@/components/reminder-banner"

export function UpdateReminderBanner() {
    const { data: settings } = trpc.settings.get.useQuery()
    const { data: update } = trpc.app.checkUpdate.useQuery(undefined, {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        retry: false,
    })
    const utils = trpc.useUtils()
    const updateSettings = trpc.settings.update.useMutation({
        onSuccess: () => utils.settings.get.invalidate(),
    })
    const openExternal = trpc.window.openExternal.useMutation()

    if (!settings || !update?.hasUpdate || !update.latestVersion) return null
    if (settings.dismissedUpdateVersion === update.latestVersion) return null

    return (
        <ReminderBanner
            variant="info"
            icon={<ArrowUpCircle />}
            onDismiss={() => updateSettings.mutate({ dismissedUpdateVersion: update.latestVersion })}
        >
            <span className="font-medium">Update available:</span> v{update.latestVersion} is out.{" "}
            <button
                onClick={() => update.releaseUrl && openExternal.mutate({ url: update.releaseUrl })}
                className={`font-medium underline underline-offset-2 transition-colors ${reminderBannerLinkClass.info}`}
            >
                View release
            </button>
        </ReminderBanner>
    )
}
