import { Suspense, lazy } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

const WorkshopWallpaperDetails = lazy(() =>
  import("@/components/workshop/workshop-wallpaper-details").then(m => ({ default: m.WorkshopWallpaperDetails })),
)

interface WorkshopDetailsPanelProps {
  wallpaper: Wallpaper
  onClose: () => void
}

export function WorkshopDetailsPanel({ wallpaper, onClose }: WorkshopDetailsPanelProps) {
  return (
    <Suspense fallback={<Skeleton className="w-full h-96 rounded-xl" />}>
      <WorkshopWallpaperDetails wallpaper={wallpaper} onClose={onClose} />
    </Suspense>
  )
}
