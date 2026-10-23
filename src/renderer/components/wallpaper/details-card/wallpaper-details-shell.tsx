import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GLASS_CLASS } from '@/hooks/use-glass'
import { trpc } from '@/lib/trpc'
import { type Wallpaper } from '../wallpaper-card'
import { WallpaperThumbnail } from '../wallpaper-thumbnail'
import { WallpaperMetadata } from './wallpaper-metadata'
import { WallpaperTags } from './wallpaper-tags'

interface WallpaperDetailsShellProps {
  wallpaper: Wallpaper
  onClose: () => void
  actions: ReactNode
  children?: ReactNode
}

export function WallpaperDetailsShell({
  wallpaper,
  onClose,
  actions,
  children,
}: WallpaperDetailsShellProps) {
  const { data: settings } = trpc.settings.get.useQuery()

  return (
    <motion.div
      id="wallpaper-details"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'border-border bg-card scrollbar-thin sticky top-0 max-h-[calc(100vh_-_var(--status-bar-h,0rem)_-_2rem)] w-full shrink-0 overflow-y-auto rounded-xl border',
        // The selected preview supplies the background. Keep its surface stable
        // while that image loads/fades, and animate the glass itself: an opacity
        // wrapper would block its backdrop blur until the wrapper reaches 1.
        settings?.dynamicBackground && GLASS_CLASS,
      )}
    >
      <div className="sticky top-2 z-10 flex h-0 justify-end pr-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 bg-black/50 text-white hover:bg-black/70"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <WallpaperThumbnail
        src={wallpaper.thumbnail}
        alt={wallpaper.title}
        containerClassName="rounded-t-xl"
      />

      <div className="p-4">
        <h2 className="text-lg font-semibold">{wallpaper.title}</h2>
        <p className="text-muted-foreground text-sm">by {wallpaper.author}</p>

        <div className="mt-4">{actions}</div>

        <WallpaperMetadata wallpaper={wallpaper} />
        <WallpaperTags tags={wallpaper.tags} />
        {children}
      </div>
    </motion.div>
  )
}
