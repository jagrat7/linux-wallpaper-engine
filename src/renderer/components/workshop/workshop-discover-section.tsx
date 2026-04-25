import { motion } from "framer-motion"
import { ArrowDown, Star } from "lucide-react"
import { WallpaperGridLayout } from "@/components/wallpaper/wallpaper-grid-layout"
import { IconButton } from "@/components/ui/icon-button"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

interface WorkshopDiscoverSectionProps {
  id: string
  title: string
  wallpapers: Wallpaper[]
  totalResults: number
  isFavorite: boolean
  selectedId?: string
  onCardClick: (wallpaper: Wallpaper) => void
  onFavoriteToggle: (sectionId: string) => void
  onSeeMore: (sectionId: string) => void
  gridClassName?: string
}

export function WorkshopDiscoverSection({
  id,
  title,
  wallpapers,
  totalResults,
  isFavorite,
  selectedId,
  onCardClick,
  onFavoriteToggle,
  onSeeMore,
  gridClassName,
}: WorkshopDiscoverSectionProps) {
  const hasMore = totalResults > wallpapers.length

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
            {hasMore && (
              <button
                type="button"
                onClick={() => onSeeMore(id)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                See more <ArrowDown className="inline-block size-3" />
              </button>
            )}
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
