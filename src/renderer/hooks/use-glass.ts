import { trpc } from "@/lib/trpc"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"

/** Frosted-blur utility declared in styles/global.css. */
export const GLASS_CLASS = "glass"

/**
 * The frosted `glass` surface only reads as glass when there is a wallpaper
 * behind it — over the flat `bg-background` it just looks muddy. Returns the
 * utility class while a wallpaper background is actually painted (the dynamic
 * background setting is on *and* a wallpaper is active/previewed), otherwise an
 * empty string. Spread the result into `cn(...)` at each call site.
 */
export function useGlass(): string {
  const { data: settings } = trpc.settings.get.useQuery()
  const { backgroundUrl } = useWallpaperBackground()

  return settings?.dynamicBackground && backgroundUrl !== null ? GLASS_CLASS : ""
}
