import { ArrowDown, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useWorkshopSort } from '@/contexts/workshop-search-context'
import { WORKSHOP_SORT_OPTIONS } from '../../../shared/constants/workshop'

export function WorkshopSortDropdown() {
  const { sortBy, setSortBy } = useWorkshopSort()

  const currentLabel = WORKSHOP_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? sortBy

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 rounded-lg px-3 text-xs font-medium tracking-wide transition-all duration-200',
            'bg-secondary/50 ring-border/40 hover:bg-secondary hover:ring-border ring-1',
          )}
        >
          <ArrowDown className="size-3" />
          <span className="hidden sm:inline">{currentLabel}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-border bg-popover/95 min-w-[160px] rounded-xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-muted-foreground/60 text-[10px] tracking-widest uppercase">
          Sort by
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        {WORKSHOP_SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setSortBy(option.value)}
            className="flex items-center justify-between rounded-lg text-xs transition-colors"
          >
            {option.label}
            {sortBy === option.value && <Check className="text-primary size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
