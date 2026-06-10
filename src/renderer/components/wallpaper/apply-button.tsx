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
import { useAtom } from "jotai"
import { lastAppliedScreenAtom } from "@/contexts/atoms/display-atoms"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"

// Decide which screen the main apply button should target.
// lastScreen is the user's remembered pick (null = all displays).
// Returns a screen name to target one display, or null for all.
function resolveTargetScreen(
    displays: { name: string }[] | undefined,
    lastScreen: string | null,
): string | null {
    if (!lastScreen) return null
    // Trust the stored pick while displays are still loading so the
    // button label stays stable across app restarts
    if (!displays) return lastScreen
    // Single display: targeting is meaningless, use the all-displays default
    if (displays.length <= 1) return null
    // Stored screen may have been unplugged — fall back to all displays
    return displays.some(d => d.name === lastScreen) ? lastScreen : null
}

interface ApplyButtonProps {
    onApply: (screen?: string) => Promise<void>
    onStop?: (screen?: string | string[]) => Promise<void>
    isApplying: boolean
    activeScreens?: string[]
    label?: string
    applyingLabel?: string
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
    className?: string
}

export function ApplyButton({
    onApply,
    onStop,
    isApplying,
    activeScreens = [],
    label = "Apply",
    applyingLabel = "Applying...",
    size = "default",
    className,
}: ApplyButtonProps) {
    const { data: displays } = trpc.display.list.useQuery()
    const [lastScreen, setLastScreen] = useAtom(lastAppliedScreenAtom)
    const activeScreenSet = React.useMemo(() => new Set(activeScreens), [activeScreens])
    const isActive = activeScreenSet.size > 0

    const targetScreen = resolveTargetScreen(displays, lastScreen)

    // Remember the user's pick so the main button targets it next time
    const handleApplyTo = (screen?: string) => {
        setLastScreen(screen ?? null)
        return onApply(screen)
    }

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
                    onClick={() => isActive && onStop ? onStop(activeScreens) : onApply(targetScreen ?? undefined)}
                    disabled={isApplying}
                >
                    {isApplying ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : isActive ? (
                        <Square className="size-4" />
                    ) : (
                        <Monitor className="size-4" />
                    )}
                    {isApplying ? applyingLabel : isActive ? "Stop" : targetScreen ? `${label} · ${targetScreen}` : label}
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
                                {displays.map((display) => {
                                    const isDisplayActive = activeScreenSet.has(display.name)
                                    return (
                                        <DropdownMenuItem
                                            key={display.name}
                                            onClick={() => isDisplayActive && onStop ? onStop(display.name) : handleApplyTo(display.name)}
                                        >
                                            {isDisplayActive ? <Square className="size-4" /> : <Monitor className="size-4" />}
                                            {isDisplayActive ? `Stop on ${display.name}` : display.name}
                                            {display.primary && (
                                                <span className="ml-auto text-xs text-muted-foreground">Primary</span>
                                            )}
                                        </DropdownMenuItem>
                                    )
                                })}
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem onClick={() => isActive && onStop ? onStop(activeScreens) : handleApplyTo()}>
                            {isActive ? <Square className="size-4" /> : <Monitor className="size-4" />}
                            {isActive ? "Stop all" : "All displays"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
