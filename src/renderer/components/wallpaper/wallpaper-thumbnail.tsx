import { cn } from "@/lib/utils"

interface WallpaperThumbnailProps {
    src: string
    alt: string
    className?: string
    containerClassName?: string
    enableHover?: boolean
    children?: React.ReactNode
}

export function WallpaperThumbnail({
    src,
    alt,
    className,
    containerClassName,
    enableHover = false,
    children,
}: WallpaperThumbnailProps) {
    return (
        <div
            className={cn(
                "relative aspect-square overflow-hidden",
                containerClassName
            )}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                className={cn(
                    "size-full object-cover",
                    enableHover && "transition-transform duration-300 group-hover:scale-105",
                    className
                )}
            />
            {children}
        </div>
    )
}
