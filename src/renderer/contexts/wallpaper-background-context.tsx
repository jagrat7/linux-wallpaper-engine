import { useMemo, type ReactNode } from "react"
import { useAtom } from "jotai"
import { trpc } from "@/lib/trpc"
import { selectedWallpaperBackgroundUrlAtom } from "@/contexts/atoms/wallpaper-background-atoms"

interface WallpaperBackgroundState {
  backgroundUrl: string | null
  setSelectedUrl: (url: string | null) => void
}

export function WallpaperBackgroundProvider({ children }: { children: ReactNode }) {
  return children
}

export function useWallpaperBackground(): WallpaperBackgroundState {
  const [selectedUrl, setSelectedUrl] = useAtom(selectedWallpaperBackgroundUrlAtom)

  const { data: activeWallpapers } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
    refetchInterval: 5000,
  })

  const activeUrl = useMemo(() => {
    const active = activeWallpapers?.[0]
    return active?.thumbnail ? `local-file://${active.thumbnail}` : null
  }, [activeWallpapers])

  const backgroundUrl = useMemo(() => selectedUrl ?? activeUrl, [selectedUrl, activeUrl])

  return useMemo(() => ({
    backgroundUrl,
    setSelectedUrl,
  }), [backgroundUrl, setSelectedUrl])
}
