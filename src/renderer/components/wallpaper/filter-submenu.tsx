import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { FilterMenuItem } from '@/components/wallpaper/filter-menu-item'
import type { FilterItem } from '@/components/wallpaper/filter-section'

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
          <FilterMenuItem
            key={item.key}
            item={item}
            selected={selected.includes(item.key)}
            onToggle={onToggle}
            multi
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
