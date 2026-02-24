import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "./filters-dropdown"
import { SortDropdown } from "./sort-dropdown"
import { RefreshButton } from "./refresh-button"
import { PageHeader } from "@/components/page-header"

interface GridHeaderProps {
    onRefresh: () => void
    isLoading: boolean
}

export function GridHeader({ onRefresh, isLoading }: GridHeaderProps) {

    return (
        <PageHeader
            title="Installed"
            description="Wallpapers downloaded to your system"
            action={<RefreshButton onClick={onRefresh} isLoading={isLoading} />}
        >
            <div id="onboarding-topbar" className="flex items-center gap-3 max-w-xl mx-auto py-1.5">
                <SearchInput className="flex-1" />

                <div className="flex items-center gap-1.5">
                    <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
                        <FiltersDropdown />
                    </div>
                    <div className="rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30">
                        <SortDropdown />
                    </div>
                </div>
            </div>
        </PageHeader>
    )
}
