import * as React from "react"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useFilter, type WallpaperFilterType } from "@/contexts/search-context"
import { FilterSection } from "./filter-section"
import { COMPATIBILITY_OPTIONS, WALLPAPER_TYPE_LABELS, type CompatibilityStatus } from "../../../shared/constants"

const TYPE_ITEMS: { key: WallpaperFilterType; label: string }[] = [
    ...Object.entries(WALLPAPER_TYPE_LABELS).map(([key, label]) => ({ key: key as WallpaperFilterType, label })),
]

const COMPAT_ITEMS = COMPATIBILITY_OPTIONS.map((opt) => ({
    key: opt.value,
    label: opt.label,
    icon: <span className={cn("size-2 rounded-full", opt.bgColor)} />,
}))

export function FiltersDropdown() {
    const {
        filterType,
        setFilterType,
        toggleFilterType,
        filterTags,
        toggleTag,
        setFilterTags,
        availableTags,
        filterResolution,
        toggleResolution,
        setFilterResolution,
        availableResolutions,
        filterCompatibility,
        toggleFilterCompatibility,
        setFilterCompatibility,
    } = useFilter()

    const activeFilterCount =
        filterType.length +
        filterTags.length +
        filterResolution.length +
        filterCompatibility.length

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation()
        setFilterType([])
        setFilterResolution([])
        setFilterTags([])
        setFilterCompatibility([])
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium tracking-wide transition-all duration-200",
                        "bg-secondary/50 ring-1 ring-border/40 hover:bg-secondary hover:ring-border",
                        activeFilterCount > 0 && "ring-primary/40 text-primary bg-primary/10"
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
                {/* Header with Clear All */}
                <div className="flex items-center justify-between px-2 py-1.5 ">
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
                    label="Type"
                    items={TYPE_ITEMS}
                    selected={filterType}
                    onToggle={(key) => toggleFilterType(key as WallpaperFilterType)}
                    multi
                    badge={filterType.length > 0 ? (
                        <span className="text-primary">{filterType.length} selected</span>
                    ) : undefined}
                />


                {availableResolutions.length > 0 && (
                    <FilterSection
                        label="Resolution"
                        items={availableResolutions.map((res) => ({ key: res, label: res }))}
                        selected={filterResolution}
                        onToggle={toggleResolution}
                        multi
                        badge={filterResolution.length > 0 ? (
                            <span className="text-primary">{filterResolution.length} selected</span>
                        ) : undefined}
                    />
                )}

                <FilterSection
                    label="Compatibility"
                    items={COMPAT_ITEMS}
                    selected={filterCompatibility}
                    onToggle={(key) => toggleFilterCompatibility(key as CompatibilityStatus)}
                    multi
                    badge={filterCompatibility.length > 0 ? (
                        <span className="text-primary">{filterCompatibility.length} selected</span>
                    ) : undefined}
                />




                {availableTags.length > 0 && (
                    <FilterSection
                        label="Tags"
                        items={availableTags.map((tag) => ({ key: tag, label: tag }))}
                        selected={filterTags}
                        onToggle={toggleTag}
                        multi
                        badge={filterTags.length > 0 ? (
                            <span className="text-primary">{filterTags.length} selected</span>
                        ) : undefined}
                    />
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
