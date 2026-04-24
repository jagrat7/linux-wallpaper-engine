import { Compass, LayoutGrid } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { SearchInput } from "@/components/search-input"
import { useWorkshopSearchQuery } from "@/contexts/workshop-search-context"
import { WorkshopFiltersDropdown } from "@/components/workshop/workshop-filters-dropdown"
import { WorkshopSortDropdown } from "@/components/workshop/workshop-sort-dropdown"

interface WorkshopToolbarProps {
  showBrowse: boolean
  onSelectDiscover: () => void
  onSelectBrowse: () => void
}

export function WorkshopToolbar({ showBrowse, onSelectDiscover, onSelectBrowse }: WorkshopToolbarProps) {
  const { searchQuery, setSearchQuery } = useWorkshopSearchQuery()

  return (
    <div className="flex items-center gap-3 max-w-2xl mx-auto pt-1.5">
      <div className="flex items-center gap-1 shrink-0">
        <IconButton
          icon={Compass}
          size="sm"
          pressed={!showBrowse}
          onClick={onSelectDiscover}
          title="Discover"
        />
        <IconButton
          icon={LayoutGrid}
          size="sm"
          pressed={showBrowse}
          onClick={onSelectBrowse}
          title="Browse"
        />
      </div>
      <SearchInput
        placeholder="Search workshop..."
        className="flex-1"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <div className="flex items-center gap-1.5">
        <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
          <WorkshopFiltersDropdown />
        </div>
        <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
          <WorkshopSortDropdown />
        </div>
      </div>
    </div>
  )
}
