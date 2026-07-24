import { useEffect } from "react"
import { useSetAtom } from "jotai"
import { useWallpaperBackground } from "@/contexts/wallpaper-background-context"
import { wallpaperBackgroundPaintedAtom } from "@/contexts/atoms/wallpaper-background-atoms"
import { useStaticFrame } from "@/hooks/use-static-frame"
import { AnimatePresence, motion } from "framer-motion"

const backgroundOverlay = <div className="absolute inset-0 bg-background/30" />

export function WallpaperBackground() {
  const { backgroundUrl } = useWallpaperBackground()
  const staticUrl = useStaticFrame(backgroundUrl)
  const setPainted = useSetAtom(wallpaperBackgroundPaintedAtom)

  // Flag the background as painted once the frame exists, and unflag it only
  // after the image has finished fading out — during a wallpaper swap the
  // outgoing image exits while the incoming one is already on screen.
  useEffect(() => {
    if (staticUrl) setPainted(true)
  }, [staticUrl, setPainted])

  useEffect(() => () => setPainted(false), [setPainted])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="popLayout" onExitComplete={() => { if (!staticUrl) setPainted(false) }}>
        {staticUrl && (
          <motion.img
            key={staticUrl}
            src={staticUrl}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 size-full scale-110 object-cover blur-2xl saturate-[0.5]"
          />
        )}
      </AnimatePresence>
      {backgroundOverlay}
    </div>
  )
}
