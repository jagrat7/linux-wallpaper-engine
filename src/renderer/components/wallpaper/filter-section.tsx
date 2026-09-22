import { Check } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface FilterItem {
  key: string
  label: string
  icon?: React.ReactNode
}

interface FilterSectionProps {
  label: string
  items: FilterItem[]
  selected: string[]
  onToggle: (key: string) => void
  multi?: boolean
  badge?: React.ReactNode
}

export function FilterSection({
  label,
  items,
  selected,
  onToggle,
  multi = false,
  badge,
}: FilterSectionProps) {
  return (
    <>
      <DropdownMenuSeparator className="bg-border/50" />
      <DropdownMenuLabel className="text-muted-foreground ml-2 flex items-center justify-between text-[10px] font-normal uppercase">
        <span>{label}</span>
        {badge}
      </DropdownMenuLabel>
      <div className="scrollbar-styled max-h-32 overflow-y-auto px-1">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            onClick={(e) => {
              if (multi) e.preventDefault()
              onToggle(item.key)
            }}
            className="flex items-center justify-between rounded-lg text-xs"
          >
            <span className="flex items-center gap-2 truncate">
              {item.icon}
              {item.label}
            </span>
            {selected.includes(item.key) && <Check className="text-primary size-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </div>
    </>
  )
}
