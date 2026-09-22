import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingRowProps {
  label: React.ReactNode
  children: React.ReactNode
  disabled?: boolean
  changed?: boolean
  onClear?: () => void
  className?: string
}

export function SettingRow({
  label,
  children,
  disabled,
  changed,
  onClear,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-4 py-3 transition-colors',
        disabled && 'cursor-not-allowed opacity-50 grayscale-[0.5] select-none',
        changed && 'bg-primary/10 ring-primary/30 ring-1',
        className,
      )}
    >
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        {changed && onClear && !disabled && (
          <button
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to global default"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
