import { atomWithStorage } from "jotai/utils"

// Screen the user last applied a wallpaper/playlist to via the apply
// dropdown. null = all displays (the default behavior)
export const lastAppliedScreenAtom = atomWithStorage<string | null>("last-applied-screen", null)
