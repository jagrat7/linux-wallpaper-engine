import { Check } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { FilterItem } from '@/components/wallpaper/filter-section'

interface FilterMenuItemProps {
  item: FilterItem
  selected: boolean
  onToggle: (key: string) => void
  // Keep the menu open after a click so several values can be picked in a row.
  multi?: boolean
}

export function FilterMenuItem({ item, selected, onToggle, multi = false }: FilterMenuItemProps) {
  return (
    <DropdownMenuItem
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
      {selected && <Check className="text-primary size-3.5 shrink-0" />}
    </DropdownMenuItem>
  )
}
