import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingRowProps {
    label: React.ReactNode
    children: React.ReactNode
    disabled?: boolean
    changed?: boolean
    onClear?: () => void
    className?: string
}

export function SettingRow({ label, children, disabled, changed, onClear, className }: SettingRowProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-between px-4 py-3 transition-colors rounded-md",
                disabled && "opacity-50 grayscale-[0.5] cursor-not-allowed select-none",
                changed && "bg-primary/10 ring-1 ring-primary/30",
                className
            )}
        >
            <span className="text-sm">{label}</span>
            <div className="flex items-center gap-2">
                {children}
                {changed && onClear && !disabled && (
                    <button
                        type="button"
                        aria-label="Reset to global default"
                        onClick={onClear}
                        className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Reset to global default"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>
        </div>
    )
}
