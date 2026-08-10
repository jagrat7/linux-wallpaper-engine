import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { KeyboardShortcut } from "@/components/keyboard-shortcut"
import { getAriaKeyShortcut, KEYBOARD_SHORTCUTS, type KeyboardShortcutId } from "@/lib/keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import { Keyboard } from "lucide-react"

const NAVIGATION_SHORTCUTS = [
    ["installed", "/"],
    ["workshop", "/workshop"],
    ["playlists", "/playlists"],
    ["displays", "/displays"],
    ["settings", "/settings"],
] as const satisfies ReadonlyArray<readonly [KeyboardShortcutId, string]>

const HELP_SHORTCUTS = Object.entries(KEYBOARD_SHORTCUTS) as Array<
    [KeyboardShortcutId, (typeof KEYBOARD_SHORTCUTS)[KeyboardShortcutId]]
>

export function AppKeyboardShortcuts() {
    const navigate = useNavigate()
    const [helpOpen, setHelpOpen] = useState(false)
    const definitions = useMemo<UseHotkeyDefinition[]>(() => {
        const search = KEYBOARD_SHORTCUTS.search
        const focusSearch = () => {
            const input = document.querySelector<HTMLInputElement>("[data-shortcut-search]")
            input?.focus()
            input?.select()
        }

        return [
            {
                hotkey: search.hotkey,
                callback: focusSearch,
                options: { ignoreInputs: false, meta: { name: search.label, description: search.description } },
            },
            ...search.alternateHotkeys.map(hotkey => ({
                hotkey,
                callback: focusSearch,
                options: { ignoreInputs: false, meta: { name: search.label, description: search.description } },
            })),
            ...NAVIGATION_SHORTCUTS.map(([id, to]) => ({
                hotkey: KEYBOARD_SHORTCUTS[id].hotkey,
                callback: () => navigate({ to }),
                options: {
                    ignoreInputs: false,
                    meta: { name: KEYBOARD_SHORTCUTS[id].label, description: KEYBOARD_SHORTCUTS[id].description },
                },
            })),
            {
                hotkey: KEYBOARD_SHORTCUTS.help.hotkey,
                callback: () => setHelpOpen(true),
                options: {
                    ignoreInputs: true,
                    meta: { name: KEYBOARD_SHORTCUTS.help.label, description: KEYBOARD_SHORTCUTS.help.description },
                },
            },
        ]
    }, [navigate])

    useHotkeys(definitions, {
        conflictBehavior: "replace",
        preventDefault: true,
        stopPropagation: true,
    })

    return (
        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-keyshortcuts={getAriaKeyShortcut("help")}
                    className="mb-2 w-full justify-start text-muted-foreground"
                >
                    <Keyboard className="size-4" />
                    Shortcuts
                    <KeyboardShortcut shortcut="help" className="ml-auto" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(42rem,85vh)] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>Navigate, search, and manage wallpapers without leaving the keyboard.</DialogDescription>
                </DialogHeader>
                <div className="divide-y divide-border">
                    {HELP_SHORTCUTS.map(([id, shortcut]) => (
                        <div key={id} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{shortcut.label}</p>
                                <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                            </div>
                            <KeyboardShortcut shortcut={id} />
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
