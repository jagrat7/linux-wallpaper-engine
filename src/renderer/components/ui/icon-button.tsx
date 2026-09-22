import type { ElementType } from 'react'
import { cn } from '@/lib/utils'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ElementType
  pressed?: boolean
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'size-7 [&>svg]:size-4',
  md: 'size-8 [&>svg]:size-4',
} as const

export function IconButton({
  icon: Icon,
  pressed,
  size = 'md',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-md transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[size],
        pressed && 'text-primary',
        className,
      )}
      {...props}
    >
      <Icon />
    </button>
  )
}
