import { useState, useCallback, useRef } from "react"
import type { Wallpaper } from "../../shared/constants/wallpaper"

const THROTTLE_MS = 150

export function useWallpaperSelection() {
    const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null)
    const lastClickTime = useRef(0)

    const toggleWallpaper = useCallback((w: Wallpaper) => {
        const now = Date.now()
        if (now - lastClickTime.current < THROTTLE_MS) return
        lastClickTime.current = now
        setSelectedWallpaper(prev => prev?.id === w.id ? null : w)
    }, [])

    const clearSelection = useCallback(() => {
        setSelectedWallpaper(null)
    }, [])

    return {
        selectedWallpaper,
        setSelectedWallpaper,
        toggleWallpaper,
        clearSelection,
    }
}
