import { atomWithStorage } from "jotai/utils"

// Screen the user last applied a wallpaper/playlist to via the apply
// dropdown, plus the wallpaper/playlist it was applied to so only that
// item's apply button targets the screen. null = all displays (the
// default behavior)
export interface LastAppliedTarget {
    screen: string
    itemId: string
}

export const lastAppliedTargetAtom = atomWithStorage<LastAppliedTarget | null>(
    "last-applied-target",
    null,
)
