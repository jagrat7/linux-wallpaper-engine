import { formatForDisplay } from "@tanstack/react-hotkeys"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { KEYBOARD_SHORTCUTS, type KeyboardShortcutId } from "@/lib/keyboard-shortcuts"
import { cn } from "@/lib/utils"

interface KeyboardShortcutProps {
    shortcut: KeyboardShortcutId
    className?: string
}

export function KeyboardShortcut({ shortcut, className }: KeyboardShortcutProps) {
    const display = formatForDisplay(KEYBOARD_SHORTCUTS[shortcut].hotkey)
    const keys = display.split(/\s*\+\s*|\s+/).filter(Boolean)

    return (
        <KbdGroup className={cn("shrink-0", className)} aria-hidden="true">
            {keys.map(key => <Kbd key={key}>{key}</Kbd>)}
        </KbdGroup>
    )
}
