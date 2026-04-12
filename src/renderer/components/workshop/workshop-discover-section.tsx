import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { IconButton } from "@/components/ui/icon-button"
import { FadeDivider } from "@/components/ui/fade-divider"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

interface WorkshopDiscoverSectionProps {
  id: string
  title: string
  wallpapers: Wallpaper[]
  isFavorite: boolean
  selectedId?: string
  onCardClick: (wallpaper: Wallpaper) => void
  onFavoriteToggle: (sectionId: string) => void
  gridClassName?: string
}

export function WorkshopDiscoverSection({
  id,
  title,
  wallpapers,
  isFavorite,
  selectedId,
  onCardClick,
  onFavoriteToggle,
  gridClassName,
}: WorkshopDiscoverSectionProps) {
  return (
    <motion.section
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold">{title}</h2>
            <span className="text-xs text-muted-foreground">{wallpapers.length} items</span>
          </div>

          <IconButton
            icon={Star}
            size="sm"
            pressed={isFavorite}
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle(id) }}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className={isFavorite ? "[&>svg]:fill-current" : ""}
          />
        </div>
        {/* <FadeDivider /> */}
      </div>

      <WallpaperGridLayout
        wallpapers={wallpapers}
        isLoading={false}
        showCompatibilityDot={false}
        selectedId={selectedId}
        onCardClick={onCardClick}
        gridClassName={gridClassName}
      />
    </motion.section>
  )
}
