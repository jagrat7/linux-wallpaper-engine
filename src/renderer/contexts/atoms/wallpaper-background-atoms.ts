import { atom } from "jotai"

export const selectedWallpaperBackgroundUrlAtom = atom<string | null>(null)

/**
 * Whether a wallpaper background image is actually painted on screen. Owned by
 * `WallpaperBackground`, which is the only component that renders it — reading
 * this instead of re-deriving the condition keeps dependent styling (see
 * `useGlass`) in step with what is really visible.
 */
export const wallpaperBackgroundPaintedAtom = atom(false)
