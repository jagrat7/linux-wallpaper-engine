import * as React from "react"
import { cn } from "@/lib/utils"

interface SettingsSectionProps {
    id?: string
    icon: React.ElementType
    title: string
    description: string
    children: React.ReactNode
    className?: string
}

export function SettingsSection({ id, icon: Icon, title, description, children, className }: SettingsSectionProps) {
    return (
        <div id={id} className={cn("rounded-xl border border-border bg-card glass", className)}>
            <div className="flex items-center gap-3 border-b border-border p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4 text-muted-foreground" />
                </div>
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="divide-y divide-border">{children}</div>
        </div>
    )
}
