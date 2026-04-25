import { cn } from "~/lib/utils"

interface FadeDividerProps {
  className?: string
  orientation?: "horizontal" | "vertical"
}

export function FadeDivider({ className, orientation = "horizontal" }: FadeDividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full bg-gradient-to-r from-border via-border via-40% to-transparent"
          : "w-px h-full bg-gradient-to-b from-border via-border via-40% to-transparent",
        className,
      )}
    />
  )
}
