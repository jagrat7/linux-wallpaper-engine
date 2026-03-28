import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useSort } from "@/contexts/search-context"
import { SORT_OPTIONS } from "../../../shared/constants/sort"

export function SortDropdown() {
    const { sortBy, setSortBy, sortOrder, setSortOrder } = useSort()

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    }

    const currentLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? sortBy

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium tracking-wide transition-all duration-200",
                        "bg-secondary/50 ring-1 ring-border/40 hover:bg-secondary hover:ring-border"
                    )}
                >
                    <div className="flex items-center gap-1">
                        {sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    </div>
                    <span className="hidden sm:inline">{currentLabel}</span>
                    <ChevronDown className="size-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl border-border bg-popover/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className="flex items-center justify-between rounded-lg text-xs transition-colors"
                    >
                        {option.label}
                        {sortBy === option.value && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                    onClick={toggleSortOrder}
                    className="flex items-center gap-2 rounded-lg text-xs"
                >
                    <ArrowUpDown className="size-3.5" />
                    {sortOrder === "asc" ? "Ascending" : "Descending"}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
