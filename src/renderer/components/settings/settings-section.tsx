import * as React from 'react'
import { cn } from '@/lib/utils'
import { useGlass } from '@/hooks/use-glass'

interface SettingsSectionProps {
  id?: string
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  const glass = useGlass()

  return (
    <div id={id} className={cn('border-border bg-card rounded-xl border', glass, className)}>
      <div className="border-border flex items-center gap-3 border-b p-4">
        <div className="bg-secondary flex size-9 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-4" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <div className="divide-border divide-y">{children}</div>
    </div>
  )
}
