import { useState } from "react"
import { trpc } from "@/lib/trpc"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { X, ScanSearch, AlertTriangle, XCircle, CheckCircle2, HelpCircle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPATIBILITY_CONFIG, type CompatibilityStatus } from "../../../shared/constants/compatibility"
import type { AppSettings } from "../../../shared/constants/app"
import { ScanReportTable } from "./scan-report-table"


const STATUS_ICONS: Record<CompatibilityStatus, typeof CheckCircle2> = {
    perfect: CheckCircle2,
    minor: AlertTriangle,
    major: AlertTriangle,
    broken: XCircle,
    unknown: HelpCircle,
}

interface CompatibilityScanRowProps {
    settings: AppSettings
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

export function CompatibilityScanRow({ settings, updateSetting }: CompatibilityScanRowProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)

    const utils = trpc.useUtils()

    const scanMutation = trpc.wallpaper.scanAll.useMutation({
        onMutate: () => setIsScanning(true),
        onSettled: () => {
            setIsScanning(false)
            utils.wallpaper.getScanReport.invalidate()
        },
    })

    const abortMutation = trpc.wallpaper.abortScan.useMutation()

    const { data: progress } = trpc.wallpaper.getScanProgress.useQuery(undefined, {
        enabled: isScanning,
        refetchInterval: isScanning ? 1000 : false,
    })

    const { data: report } = trpc.wallpaper.getScanReport.useQuery()

    const { data: flatpakData } = trpc.settings.isFlatpak.useQuery()
    const isFlatpakEnv = flatpakData?.isFlatpak ?? false

    const handleStartScan = () => {
        setDialogOpen(false)
        scanMutation.mutate()
    }

    const handleAbort = () => {
        abortMutation.mutate()
    }

    const progressPercent = progress?.total
        ? Math.round((progress.scanned / progress.total) * 100)
        : 0

    // Group report by status
    const statusCounts = report?.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div >
            <div className="px-4 py-3 space-y-3">
                {isScanning && progress?.running ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                    Testing {progress.scanned}/{progress.total}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {progress.current}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleAbort}
                            >
                                <X className="size-4 mr-1" />
                                Cancel
                            </Button>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm">Scan all wallpapers</p>
                            <p className="text-xs text-muted-foreground">
                                Test each wallpaper for compatibility issues
                            </p>
                        </div>
                        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={scanMutation.isPending}
                                >
                                    <ScanSearch className="size-4 mr-2" />
                                    {report && report.length > 0 ? "Rescan" : "Scan"}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Scan Wallpaper Compatibility</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will test each wallpaper by briefly running it in a small
                                        hidden window. Wallpapers you&apos;ve already tagged will be
                                        skipped. This may take several minutes depending on how many
                                        wallpapers you have.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleStartScan}>
                                        Start Scan
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}

                {/* Scan Report Summary */}
                {report && report.length > 0 && !isScanning && (
                    <button
                        className="flex w-full items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs hover:bg-secondary transition-colors"
                        onClick={() => setReportOpen(true)}
                    >
                        <div className="flex items-center gap-3">
                            {statusCounts && (['perfect', 'minor', 'major', 'broken'] as const).map((status) => {
                                const count = statusCounts[status]
                                if (!count) return null
                                const config = COMPATIBILITY_CONFIG[status]
                                const Icon = STATUS_ICONS[status]
                                return (
                                    <span key={status} className={cn("flex items-center gap-1", config.textColor)}>
                                        <Icon className="size-3" />
                                        {count}
                                    </span>
                                )
                            })}
                            <span className="text-muted-foreground">{report.length} tested</span>
                        </div>
                        <FileText className="size-3.5 text-muted-foreground" />
                    </button>
                )}

                {/* Report Dialog */}
                <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
                    <AlertDialogContent className="max-w-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Scan Report</AlertDialogTitle>
                        </AlertDialogHeader>
                        <ScanReportTable entries={report ?? []} />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Close</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

   
        </div>
    )
}
