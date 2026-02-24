import type { ReactNode } from "react"

interface PageHeaderProps {
    title: string
    description: string
    action?: ReactNode
    children?: ReactNode
    id?: string
    className?: string
}

export function PageHeader({ title, description, action, children, id, className }: PageHeaderProps) {
    return (
        <div className={`mb-6 space-y-4 ${className ?? ""}`} id={id}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">{description}</p>
                </div>

                {action && <div className="shrink-0">{action}</div>}
            </div>

            {children}
        </div>
    )
}
