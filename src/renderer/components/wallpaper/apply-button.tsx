import * as React from "react"
import { Monitor, Loader2, ChevronDown, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"

interface ApplyButtonProps {
    onApply: (screen?: string) => Promise<void>
    onStop?: (screen?: string) => Promise<void>
    isApplying: boolean
    isActive?: boolean
    label?: string
    applyingLabel?: string
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
    className?: string
}

export function ApplyButton({
    onApply,
    onStop,
    isApplying,
    isActive = false,
    label = "Apply",
    applyingLabel = "Applying...",
    size = "default",
    className,
}: ApplyButtonProps) {
    const { data: displays } = trpc.display.list.useQuery()

    return (
        <div className={className}>
            <div className="flex">
                <Button
                    size={size}
                    variant={isActive ? "outline" : "default"}
                    className={cn(
                        "gap-2 rounded-r-none flex-1",
                        isActive && "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    )}
                    onClick={() => isActive && onStop ? onStop() : onApply()}
                    disabled={isApplying}
                >
                    {isApplying ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : isActive ? (
                        <Square className="size-4" />
                    ) : (
                        <Monitor className="size-4" />
                    )}
                    {isApplying ? applyingLabel : isActive ? "Stop" : label}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size={size}
                            variant={isActive ? "outline" : "default"}
                            className={cn(
                                "rounded-l-none border-l px-2",
                                isActive
                                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    : "border-primary-foreground/20"
                            )}
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
                                        onClick={() => isActive && onStop ? onStop(display.name) : onApply(display.name)}
                                    >
                                        {isActive ? <Square className="size-4" /> : <Monitor className="size-4" />}
                                        {isActive ? `Stop on ${display.name}` : display.name}
                                        {display.primary && (
                                            <span className="ml-auto text-xs text-muted-foreground">Primary</span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem onClick={() => isActive && onStop ? onStop() : onApply()}>
                            {isActive ? <Square className="size-4" /> : <Monitor className="size-4" />}
                            {isActive ? "Stop all" : "All displays"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
