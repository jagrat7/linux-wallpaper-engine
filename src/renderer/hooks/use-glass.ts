import { useAtomValue } from "jotai"
import { wallpaperBackgroundPaintedAtom } from "@/contexts/atoms/wallpaper-background-atoms"

/** Frosted-blur utility declared in styles/global.css. */
export const GLASS_CLASS = "glass"

/**
 * The frosted `glass` surface only reads as glass when there is a wallpaper
 * behind it — over the flat `bg-background` it just looks muddy. Returns the
 * utility class while a wallpaper background is painted, otherwise an empty
 * string. Spread the result into `cn(...)` at each call site.
 *
 * This tracks the rendered image rather than the settings that lead to it, so
 * glass never appears during the window where a wallpaper is selected but its
 * static frame has not been decoded yet.
 */
export function useGlass(): string {
  return useAtomValue(wallpaperBackgroundPaintedAtom) ? GLASS_CLASS : ""
}
