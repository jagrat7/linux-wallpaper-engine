import { useLayoutEffect, useRef, useState, type Key, type ReactNode } from "react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { columnsForWidth } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { DEFAULT_WALLPAPER_GRID_DENSITY, WALLPAPER_GRID_GAP } from "../../../shared/constants/grid"

const WALLPAPER_DETAILS_MIN_WIDTH = 320 // matches the original Installed w-80 panel
export const WALLPAPER_GRID_TRANSITION = { duration: 0.3, ease: "easeOut" } as const

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
 * minimums and animation timing.
 */
export function WallpaperGridShell({ children, details, detailsKey }: WallpaperGridShellProps) {
    const shellRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [reserveDetailsColumn, setReserveDetailsColumn] = useState(details !== null)
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

    // Reserve the column before paint when opening. On close it remains reserved
    // until the panel finishes shrinking, so the last grid reflow is not abrupt.
    useLayoutEffect(() => {
        if (hasDetails) setReserveDetailsColumn(true)
    }, [hasDetails])

    const density = settings?.wallpaperGridDensity ?? DEFAULT_WALLPAPER_GRID_DENSITY
    const gridWidth = reserveDetailsColumn
        ? Math.max(0, width - WALLPAPER_DETAILS_MIN_WIDTH - WALLPAPER_GRID_GAP)
        : width
    const gridColumns = columnsForWidth(gridWidth, density)

    return (
        <LayoutGroup>
            <div ref={shellRef} className="flex flex-1 items-start">
                <div className="min-w-0 flex-1 h-fit">
                    {children(gridColumns)}
                </div>

                <aside
                    className="sticky top-0 min-w-0 shrink-0 overflow-hidden"
                    style={{
                        width: reserveDetailsColumn ? WALLPAPER_DETAILS_MIN_WIDTH : 0,
                        minWidth: reserveDetailsColumn ? WALLPAPER_DETAILS_MIN_WIDTH : 0,
                        marginLeft: reserveDetailsColumn ? WALLPAPER_GRID_GAP : 0,
                        pointerEvents: hasDetails ? "auto" : "none",
                    }}
                >
                    <AnimatePresence
                        initial={false}
                        mode="wait"
                        onExitComplete={() => {
                            if (!hasDetails) setReserveDetailsColumn(false)
                        }}
                    >
                        {details && (
                            <motion.div
                                key={detailsKey ?? "wallpaper-details"}
                                className="w-full"
                                initial={{ opacity: 0, x: 32 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 32 }}
                                transition={WALLPAPER_GRID_TRANSITION}
                            >
                                {details}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </aside>
            </div>
        </LayoutGroup>
    )
}
