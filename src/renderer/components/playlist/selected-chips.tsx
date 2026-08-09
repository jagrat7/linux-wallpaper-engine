import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import type { Wallpaper } from "../../../shared/constants/wallpaper"

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
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5"
            >
                {wallpapers.map(wallpaper => (
                    <motion.div
                        key={wallpaper.path}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center rounded-lg border border-primary/20 bg-primary/10 text-sm transition-colors hover:bg-primary/15"
                    >
                        <button
                            type="button"
                            className="max-w-[174px] truncate rounded-l-lg py-1.5 pl-3 pr-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
                            className="mr-1 size-6 p-0 hover:bg-destructive/20 hover:text-destructive"
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
