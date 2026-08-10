import { normalizeRegisterableHotkey, type RegisterableHotkey } from "@tanstack/react-hotkeys"

interface KeyboardShortcut {
    hotkey: RegisterableHotkey
    alternateHotkeys?: RegisterableHotkey[]
    label: string
    description: string
    category: "Navigation" | "Actions" | "Grid"
}

export const KEYBOARD_SHORTCUTS = {
    search: {
        hotkey: "Mod+K",
        alternateHotkeys: ["Mod+F"],
        label: "Search",
        description: "Focus search on the current page",
        category: "Navigation",
    },
    installed: {
        hotkey: "Mod+1",
        label: "Installed wallpapers",
        description: "Open installed wallpapers",
        category: "Navigation",
    },
    workshop: {
        hotkey: "Mod+2",
        label: "Workshop",
        description: "Open the Steam Workshop",
        category: "Navigation",
    },
    playlists: {
        hotkey: "Mod+3",
        label: "Playlists",
        description: "Open playlists",
        category: "Navigation",
    },
    displays: {
        hotkey: "Mod+4",
        label: "Displays",
        description: "Open display settings",
        category: "Navigation",
    },
    settings: {
        hotkey: "Mod+5",
        label: "Settings",
        description: "Open application settings",
        category: "Navigation",
    },
    savePlaylist: {
        hotkey: "Mod+S",
        label: "Save playlist",
        description: "Save the playlist being edited",
        category: "Actions",
    },
    closeDetails: {
        hotkey: "Escape",
        label: "Close details",
        description: "Close the active panel or dialog",
        category: "Actions",
    },
    help: {
        hotkey: { key: "/", shift: true },
        label: "Keyboard shortcuts",
        description: "Show this keyboard shortcut reference",
        category: "Actions",
    },
    gridMove: {
        hotkey: "ArrowRight",
        label: "Move in grid",
        description: "Use arrow keys to move between wallpaper cards",
        category: "Grid",
    },
    gridRowEdge: {
        hotkey: "Home",
        label: "First or last in row",
        description: "Use Home or End to move within a row",
        category: "Grid",
    },
    gridEdge: {
        hotkey: "Mod+Home",
        label: "First or last wallpaper",
        description: "Use the modifier with Home or End to cross the full grid",
        category: "Grid",
    },
    activate: {
        hotkey: "Enter",
        label: "Activate",
        description: "Use Enter or Space to activate the focused control",
        category: "Grid",
    },
} as const satisfies Record<string, KeyboardShortcut>

export type KeyboardShortcutId = keyof typeof KEYBOARD_SHORTCUTS

export function getAriaKeyShortcut(id: KeyboardShortcutId) {
    return normalizeRegisterableHotkey(KEYBOARD_SHORTCUTS[id].hotkey)
}
