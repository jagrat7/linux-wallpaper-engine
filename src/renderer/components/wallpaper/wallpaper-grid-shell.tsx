import { useLayoutEffect, useRef, useState, type Key, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn, columnsForWidth } from '@/lib/utils'
import { trpc } from '@/lib/trpc'
import { DEFAULT_WALLPAPER_GRID_DENSITY, WALLPAPER_GRID_GAP } from '../../../shared/constants/grid'

const WALLPAPER_DETAILS_MIN_WIDTH = 320 // matches the original Installed w-80 panel
const WALLPAPER_DETAILS_TRANSITION = { duration: 0.3, ease: 'easeOut' } as const

interface WallpaperGridShellProps {
  children: (columns: number) => ReactNode
  details: ReactNode | null
  detailsKey?: Key
}

/**
 * Shared responsive shell for wallpaper grids and their details panel.
 *
 * The panel keeps the shared details width. The grid calculates its columns
 * from the space left beside it, so Installed and Workshop use the same card
 * minimums. The grid reflows in a single frame when the panel opens or closes;
 * only the panel itself animates.
 */
export function WallpaperGridShell({ children, details, detailsKey }: WallpaperGridShellProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const hasDetails = details !== null
  const { data: settings } = trpc.settings.get.useQuery()

  useLayoutEffect(() => {
    const node = shellRef.current
    if (!node) return

    const measure = () => setWidth(node.clientWidth)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const density = settings?.wallpaperGridDensity ?? DEFAULT_WALLPAPER_GRID_DENSITY
  const gridWidth = hasDetails
    ? Math.max(0, width - WALLPAPER_DETAILS_MIN_WIDTH - WALLPAPER_GRID_GAP)
    : width
  const gridColumns = columnsForWidth(gridWidth, density)

  return (
    <div ref={shellRef} className="flex flex-1 items-start">
      <div className="h-fit min-w-0 flex-1">{children(gridColumns)}</div>

      <aside
        className={cn(
          'sticky top-0 shrink-0',
          // On close the column is released straight away, so the exiting
          // panel fades out over the grid's right edge instead of holding it.
          hasDetails ? 'overflow-hidden' : '*:absolute *:top-0 *:right-0',
        )}
        style={{
          width: hasDetails ? WALLPAPER_DETAILS_MIN_WIDTH : 0,
          marginLeft: hasDetails ? WALLPAPER_GRID_GAP : 0,
          pointerEvents: hasDetails ? 'auto' : 'none',
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {details && (
            <motion.div
              key={detailsKey ?? 'wallpaper-details'}
              style={{ width: WALLPAPER_DETAILS_MIN_WIDTH }}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={WALLPAPER_DETAILS_TRANSITION}
            >
              {details}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  )
}
