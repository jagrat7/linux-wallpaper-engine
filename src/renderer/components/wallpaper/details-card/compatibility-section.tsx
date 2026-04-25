import { ShieldCheck } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { trpc } from "@/lib/trpc"
import { COMPATIBILITY_OPTIONS, type CompatibilityStatus } from "../../../../shared/constants/compatibility"

export function CompatibilitySection({ wallpaperPath }: { wallpaperPath: string }) {
    const utils = trpc.useUtils()
    const { data: overrides } = trpc.wallpaper.getOverrides.useQuery(
        { path: wallpaperPath },
        { enabled: !!wallpaperPath },
    )

    const setCompatibility = trpc.wallpaper.setCompatibility.useMutation({
        onSuccess: () => {
            utils.wallpaper.getOverrides.invalidate({ path: wallpaperPath })
            utils.wallpaper.getCompatibilityMap.invalidate()
        },
    })

    const currentStatus: CompatibilityStatus = overrides?.compatibility ?? "unknown"

    return (
        <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4" />
                    Compatibility
                </span>
                <Select
                    value={currentStatus}
                    onValueChange={(value) => {
                        setCompatibility.mutate({
                            path: wallpaperPath,
                            status: value as CompatibilityStatus,
                        })
                    }}
                >
                    <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {COMPATIBILITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                <span className="flex items-center gap-2">
                                    <span className={`size-2 rounded-full ${option.bgColor}`} />
                                    {option.label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
