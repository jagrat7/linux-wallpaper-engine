import { WorkshopWallpaperDetails } from '@/components/workshop/workshop-wallpaper-details'
import type { Wallpaper } from '../../../shared/constants/wallpaper'

interface WorkshopDetailsPanelProps {
  wallpaper: Wallpaper
  onClose: () => void
}

export function WorkshopDetailsPanel({ wallpaper, onClose }: WorkshopDetailsPanelProps) {
  return <WorkshopWallpaperDetails wallpaper={wallpaper} onClose={onClose} />
}
