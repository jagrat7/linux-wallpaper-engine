import * as React from "react"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useWorkshopFilter, type AgeRating, type WallpaperFilterType } from "@/contexts/workshop-search-context"
import { FilterSection } from "@/components/wallpaper/filter-section"
import { AGE_RATING_OPTIONS, FILTER_TYPE_OPTIONS } from "../../../shared/constants/wallpaper"

const TYPE_ITEMS = FILTER_TYPE_OPTIONS
    .filter(o => o.value !== 'all')
    .map(o => ({ key: o.value, label: o.label }))

const AGE_RATING_ITEMS = AGE_RATING_OPTIONS.map((opt) => ({
    key: opt.value,
    label: opt.label,
}))

export function WorkshopFiltersDropdown() {
    const {
        filterType,
        setFilterType,
        toggleFilterType,
        filterAgeRating,
        setFilterAgeRating,
        toggleFilterAgeRating,
    } = useWorkshopFilter()

    const activeFilterCount = filterType.length + filterAgeRating.length

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation()
        setFilterType([])
        setFilterAgeRating([])
    }

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
                    <SlidersHorizontal className="size-3.5" />
                    <span className="hidden sm:inline">
                        {activeFilterCount > 0 ? `${activeFilterCount} Filters` : "Filters"}
                    </span>
                    <ChevronDown className="size-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border-border bg-popover scrollbar-styled"
            >
                <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Filters</span>
                    {activeFilterCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] hover:text-destructive"
                            onClick={handleClearAll}
                        >
                            <X className="mr-1 size-3" />
                            Clear All
                        </Button>
                    )}
                </div>

                <FilterSection
                    label="Age rating"
                    items={AGE_RATING_ITEMS}
                    selected={filterAgeRating}
                    onToggle={(key) => toggleFilterAgeRating(key as AgeRating)}
                    multi
                    badge={filterAgeRating.length > 0 ? (
                        <span className="text-primary">{filterAgeRating.length} selected</span>
                    ) : undefined}
                />

                <FilterSection
                    label="Type"
                    items={TYPE_ITEMS}
                    selected={filterType}
                    onToggle={(key) => toggleFilterType(key as WallpaperFilterType)}
                    multi
                    badge={filterType.length > 0 ? (
                        <span className="text-primary">{filterType.length} selected</span>
                    ) : undefined}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
