import { Check } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import type { FilterItem } from './filter-section'

interface FilterSubmenuProps {
  label: string
  items: FilterItem[]
  selected: string[]
  onToggle: (key: string) => void
}

// A multi-select category that opens as its own submenu, so long lists don't stretch the parent menu.
export function FilterSubmenu({ label, items, selected, onToggle }: FilterSubmenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="mx-1 rounded-lg text-xs">
        <span className="flex-1">{label}</span>
        {selected.length > 0 && (
          <span className="text-primary text-[10px]">{selected.length} selected</span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="scrollbar-styled max-h-72 w-56 overflow-y-auto rounded-xl">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            onClick={(e) => {
              e.preventDefault()
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
