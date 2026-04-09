import { ArrowLeft, Save, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "../wallpaper/filters-dropdown"
import { SortDropdown } from "../wallpaper/sort-dropdown"
import { WallpaperGridLayout } from "../wallpaper/wallpaper-grid-layout"
import { PlaylistSettingsBar } from "./playlist-settings-bar"
import { SelectedChips } from "./selected-chips"
import type { Playlist } from "../../../shared/constants/playlist"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useSearch } from "@/contexts/search-context"
import { usePlaylistEditor } from "@/hooks/use-playlist-editor"
import { useMemo, useCallback } from "react"

interface PlaylistEditorGridProps {
    editPlaylist?: Playlist | null
}

export function PlaylistEditorGrid({ editPlaylist }: PlaylistEditorGridProps) {
    const { searchQuery, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility } = useSearch()
    const {
        wallpapers: transformedWallpapers,
        isLoading,
        compatibilityMap,
        appSettings,
    } = useWallpapers()

    const editor = usePlaylistEditor(editPlaylist)

    // Apply search-context filters and sorting
    const filteredWallpapers = useMemo(() =>
        filterAndSortWallpapers(transformedWallpapers, {
            filterType,
            filterAgeRating,
            filterTags,
            filterResolution,
            filterCompatibility,
            sortBy,
            sortOrder,
            compatibilityMap,
        }),
        [transformedWallpapers, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    // Derive selected wallpaper objects for the chips list
    const selectedWallpaperData = useMemo(
        () => transformedWallpapers.filter(w => editor.selectedSet.has(w.path)),
        [transformedWallpapers, editor.selectedSet],
    )

    // Stable overlay renderer — only re-creates when selection changes
    const renderCardOverlay = useCallback((wallpaper: Wallpaper) => {
        if (!editor.selectedSet.has(wallpaper.path)) return null
        return (
            <div className="absolute bottom-2 right-2 size-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary-foreground/20">
                <Check className="size-3.5 text-primary-foreground" />
            </div>
        )
    }, [editor.selectedSet])

    return (
        <div className="flex flex-col h-full">
            <div className="mb-6 space-y-4">
                {/* Header */}
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon-sm" onClick={editor.handleBack}>
                            <ArrowLeft className="size-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">
                                {editor.isEditing ? "Edit Playlist" : "New Playlist"}
                            </h1>
                            <p className="text-muted-foreground">
                                Select wallpapers to add to your playlist
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={editor.handleBack}>
                            Cancel
                        </Button>
                        <Button onClick={() => editor.form.handleSubmit()} className="gap-2">
                            <Save className="size-4" />
                            {editor.isSaving ? "Saving..." : "Save Playlist"}
                        </Button>
                    </div>
                </div>

                {/* Settings */}
                <PlaylistSettingsBar
                    form={editor.form}
                    selectedCount={editor.selectedPaths.length}
                    serverError={editor.serverError}
                    onClearServerError={editor.clearServerError}
                />

                {/* Selected wallpapers as removable chips */}
                <SelectedChips
                    wallpapers={selectedWallpaperData}
                    onRemove={editor.handleRemoveWallpaper}
                />

                {/* Search + filters */}
                <div className="flex max-w-xl items-center gap-2">
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

            {/* Wallpaper grid */}
            <WallpaperGridLayout
                wallpapers={filteredWallpapers}
                isLoading={isLoading}
                compatibilityMap={compatibilityMap}
                showCompatibilityDot={appSettings?.showCompatibilityDot ?? true}
                onCardClick={editor.handleToggleWallpaper}
                emptyMessage="No wallpapers found"
                emptySubMessage={searchQuery ? "Try a different search term" : "Install wallpapers first"}
                renderCardOverlay={renderCardOverlay}
            />
        </div>
    )
}
