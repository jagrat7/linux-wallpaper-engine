import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { useWallpaperBackground } from '@/contexts/wallpaper-background-context'
import { wallpaperBackgroundPaintedAtom } from '@/contexts/atoms/wallpaper-background-atoms'
import { useStaticFrame } from '@/hooks/use-static-frame'
import { AnimatePresence, motion } from 'framer-motion'

const backgroundOverlay = <div className="bg-background/30 absolute inset-0" />

export function WallpaperBackground() {
  const { backgroundUrl } = useWallpaperBackground()
  const staticUrl = useStaticFrame(backgroundUrl)
  const setPainted = useSetAtom(wallpaperBackgroundPaintedAtom)

  // Keep surfaces stable through the fade-out. Removing their glass while the
  // background is still visible makes the whole page flash opaque on close.
  useEffect(() => {
    if (staticUrl !== null) setPainted(true)
  }, [staticUrl, setPainted])

  useEffect(() => () => setPainted(false), [setPainted])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence
        mode="popLayout"
        onExitComplete={() => {
          if (staticUrl === null) setPainted(false)
        }}
      >
        {staticUrl && (
          <motion.img
            key={staticUrl}
            src={staticUrl}
            alt=""
            // Avoid the compositor flash seen when native opacity effects finish.
            // A custom property keeps this fade in Motion's JavaScript frame loop.
            style={{ opacity: 'var(--background-opacity)' }}
            initial={{ '--background-opacity': 0 }}
            animate={{ '--background-opacity': 0.4 }}
            exit={{ '--background-opacity': 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0 size-full scale-110 object-cover blur-2xl saturate-[0.5]"
          />
        )}
      </AnimatePresence>
      {backgroundOverlay}
    </div>
  )
}
