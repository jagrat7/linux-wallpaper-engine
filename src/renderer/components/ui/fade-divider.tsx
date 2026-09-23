import { cn } from '~/lib/utils'

interface FadeDividerProps {
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function FadeDivider({ className, orientation = 'horizontal' }: FadeDividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        orientation === 'horizontal'
          ? 'from-border via-border h-px w-full bg-gradient-to-r via-40% to-transparent'
          : 'from-border via-border h-full w-px bg-gradient-to-b via-40% to-transparent',
        className,
      )}
    />
  )
}
