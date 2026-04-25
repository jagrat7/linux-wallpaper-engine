import { Suspense, lazy } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

const WorkshopWallpaperDetails = lazy(() =>
  import("@/components/workshop/workshop-wallpaper-details").then(m => ({ default: m.WorkshopWallpaperDetails })),
)

interface WorkshopDetailsPanelProps {
  wallpaper: Wallpaper | null
  onClose: () => void
  onExitComplete: () => void
}

export function WorkshopDetailsPanel({ wallpaper, onClose, onExitComplete }: WorkshopDetailsPanelProps) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {wallpaper && (
        <motion.div
          className="sticky top-0"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Suspense fallback={<Skeleton className="w-80 h-96 rounded-xl" />}>
            <WorkshopWallpaperDetails wallpaper={wallpaper} onClose={onClose} />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
