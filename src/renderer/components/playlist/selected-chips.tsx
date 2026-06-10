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
                        onClick={() => onChipClick(wallpaper.path)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm transition-colors hover:bg-primary/15"
                    >
                        <span className="max-w-[150px] truncate font-medium">
                            {wallpaper.title}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-5 p-0 hover:bg-destructive/20 hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove(wallpaper.path)
                            }}
                        >
                            <X className="size-3" />
                        </Button>
                    </motion.div>
                ))}
            </motion.div>
        </AnimatePresence>
    )
}
