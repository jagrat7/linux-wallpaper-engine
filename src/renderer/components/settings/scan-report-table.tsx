import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { AlertTriangle, XCircle, CheckCircle2, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPATIBILITY_CONFIG, type CompatibilityStatus } from "../../../shared/constants/compatibility"

const STATUS_ICONS: Record<CompatibilityStatus, typeof CheckCircle2> = {
    perfect: CheckCircle2,
    minor: AlertTriangle,
    major: AlertTriangle,
    broken: XCircle,
    unknown: HelpCircle,
}



interface ScanReportEntry {
    path: string
    title: string
    status: CompatibilityStatus
    errors: string[]
    lastTested: number
}

export function ScanReportTable({ entries }: { entries: ScanReportEntry[] }) {

    return (
        <div className="max-h-80 overflow-y-auto scrollbar-styled">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Wallpaper</TableHead>
                        <TableHead className="w-24 text-right">Status</TableHead>
                        <TableHead className="w-14 text-right">Issues</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((entry) => {
                        const config = COMPATIBILITY_CONFIG[entry.status]
                        const Icon = STATUS_ICONS[entry.status]
                        return (
                            <TableRow key={entry.path}>
                                <TableCell className="max-w-0">
                                    <p className="text-xs font-medium truncate" title={entry.title}>{entry.title}</p>
                                </TableCell>
                                <TableCell className="text-right align-top">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Icon className={cn("size-3.5 shrink-0", config.textColor)} />
                                        <span className={cn("text-xs", config.textColor)}>{config.label}</span>
                                    </div>
                                    {entry.errors.length > 0 && (
                                        <div className="mt-0.5">
                                            {entry.errors.slice(0, 2).map((err, i) => (
                                                <p key={i} className="text-[11px] text-muted-foreground truncate max-w-[200px] ml-auto" title={err}>
                                                    {err}
                                                </p>
                                            ))}
                                            {entry.errors.length > 2 && (
                                                <p className="text-[11px] text-muted-foreground text-right">+{entry.errors.length - 2} more</p>
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                    {entry.errors.length > 0 ? entry.errors.length : '\u2014'}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
   
        </div>
    )
}
