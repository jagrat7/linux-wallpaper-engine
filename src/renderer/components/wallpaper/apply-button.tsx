import * as React from "react"
import { Monitor, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"

interface ApplyButtonProps {
    onApply: (screen?: string) => Promise<void>
    isApplying: boolean
    label?: string
    applyingLabel?: string
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
    className?: string
}

export function ApplyButton({
    onApply,
    isApplying,
    label = "Apply",
    applyingLabel = "Applying...",
    size = "default",
    className,
}: ApplyButtonProps) {
    const { data: displays } = trpc.display.list.useQuery()

    const handleApply = async (screen?: string) => {
        await onApply(screen)
    }

    return (
        <div className={className}>
            <div className="flex">
                <Button
                    size={size}
                    className="gap-2 rounded-r-none flex-1"
                    onClick={() => handleApply()}
                    disabled={isApplying}
                >
                    {isApplying ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Monitor className="size-4" />
                    )}
                    {isApplying ? applyingLabel : label}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size={size}
                            className="rounded-l-none border-l border-primary-foreground/20 px-2"
                            disabled={isApplying}
                        >
                            <ChevronDown className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        {displays && displays.length > 0 && (
                            <>
                                {displays.map((display) => (
                                    <DropdownMenuItem
                                        key={display.name}
                                        onClick={() => handleApply(display.name)}
                                    >
                                        <Monitor className="size-4" />
                                        {display.name}
                                        {display.primary && (
                                            <span className="ml-auto text-xs text-muted-foreground">Primary</span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem onClick={() => handleApply()}>
                            <Monitor className="size-4" />
                            All
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
