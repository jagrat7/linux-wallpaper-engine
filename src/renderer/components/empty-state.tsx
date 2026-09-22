import type { ComponentType, SVGProps } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface EmptyStateProps {
  className?: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: string
}

export function EmptyState({ className, icon: Icon, title, description }: EmptyStateProps) {
  return (
    <motion.div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center py-20',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Icon className="mb-4 size-12 opacity-50" aria-hidden />
      <p className="text-foreground font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-center text-sm leading-relaxed">{description}</p>
      )}
    </motion.div>
  )
}
