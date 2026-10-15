import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { Wallpaper } from '../../../shared/constants/wallpaper'

interface SelectedChipsProps {
  wallpapers: Wallpaper[]
  onRemove: (path: string) => void
  onChipClick: (path: string) => void
}

export function SelectedChips({ wallpapers, onRemove, onChipClick }: SelectedChipsProps) {
  if (wallpapers.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="flex flex-wrap gap-1.5"
      >
        {wallpapers.map((wallpaper) => (
          <motion.div
            key={wallpaper.path}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="border-primary/20 bg-primary/10 flex items-center rounded-lg border text-sm"
          >
            <button
              type="button"
              className="hover:bg-primary/15 focus-visible:ring-ring max-w-[174px] truncate rounded-l-lg py-1.5 pr-2 pl-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              onClick={() => onChipClick(wallpaper.path)}
            >
              {wallpaper.title}
              <span className="sr-only">, locate in playlist</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${wallpaper.title} from playlist`}
              className="hover:bg-destructive/20 hover:text-destructive mr-1 size-6 p-0"
              onClick={() => onRemove(wallpaper.path)}
            >
              <X className="size-3" />
            </Button>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
