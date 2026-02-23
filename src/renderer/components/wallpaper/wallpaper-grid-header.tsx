import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "./filters-dropdown"
import { SortDropdown } from "./sort-dropdown"
import { RefreshButton } from "./refresh-button"

interface GridHeaderProps {
    onRefresh: () => void
    isLoading: boolean
}

export function GridHeader({ onRefresh, isLoading }: GridHeaderProps) {

    return (
        <div className="mb-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Installed</h1>
                    <p className="text-muted-foreground">
                        Wallpapers downloaded to your system
                    </p>
                </div>
                <RefreshButton onClick={onRefresh} isLoading={isLoading} />
            </div>

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
        </div>
    )
}
