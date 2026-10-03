import { memo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { WallpaperCard } from './wallpaper-card'
import type { Wallpaper } from '../../../shared/constants/wallpaper'
import type { CompatibilityStatus } from '../../../shared/constants/compatibility'
import { WALLPAPER_GRID_TRANSITION } from './wallpaper-grid-shell'

interface WallpaperGridCardItemProps {
  wallpaper: Wallpaper
  selected: boolean
  onClick: (wallpaper: Wallpaper) => void
  compatibilityStatus?: CompatibilityStatus
  showCompatibilityDot: boolean
  glassClassName: string
  overlay?: ReactNode
}

// Memoized so a parent re-render (e.g. selection change) only re-renders the
// cards whose props actually changed, not the whole grid.
export const WallpaperGridCardItem = memo(function WallpaperGridCardItem({
  wallpaper,
  selected,
  onClick,
  compatibilityStatus,
  showCompatibilityDot,
  glassClassName,
  overlay,
}: WallpaperGridCardItemProps) {
  return (
    <motion.div
      layout
      layoutId={wallpaper.id}
      transition={WALLPAPER_GRID_TRANSITION}
      className="relative"
      data-wallpaper-path={wallpaper.path}
    >
      <WallpaperCard
        wallpaper={wallpaper}
        selected={selected}
        onClick={onClick}
        compatibilityStatus={compatibilityStatus}
        showCompatibilityDot={showCompatibilityDot}
        glassClassName={glassClassName}
      />
      {overlay}
    </motion.div>
  )
})
