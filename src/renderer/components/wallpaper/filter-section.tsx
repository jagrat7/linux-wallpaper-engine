import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { FilterMenuItem } from '@/components/wallpaper/filter-menu-item'

export interface FilterItem {
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
          <FilterMenuItem
            key={item.key}
            item={item}
            selected={selected.includes(item.key)}
            onToggle={onToggle}
            multi={multi}
          />
        ))}
      </div>
    </>
  )
}
