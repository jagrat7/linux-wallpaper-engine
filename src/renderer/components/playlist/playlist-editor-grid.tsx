import { ArrowLeft, Save, Check, CheckCheck, XCircle, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "../wallpaper/filters-dropdown"
import { SortDropdown } from "../wallpaper/sort-dropdown"
import { WallpaperGridLayout } from "../wallpaper/wallpaper-grid-layout"
import { PlaylistSettingsBar } from "./playlist-settings-bar"
import { SelectedChips } from "./selected-chips"
import type { Playlist } from "../../../shared/constants/playlist"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useWallpaperSearch } from "@/contexts/wallpaper-search-context"
import { usePlaylistEditor } from "@/hooks/use-playlist-editor"
import { useMemo, useCallback } from "react"

interface PlaylistEditorGridProps {
    editPlaylist?: Playlist | null
}

export function PlaylistEditorGrid({ editPlaylist }: PlaylistEditorGridProps) {
    const { searchQuery, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility } = useWallpaperSearch()
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
            searchQuery,
            filterType,
            filterAgeRating,
            filterTags,
            filterResolution,
            filterCompatibility,
            sortBy,
            sortOrder,
            compatibilityMap,
        }),
        [transformedWallpapers, searchQuery, filterType, filterAgeRating, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    // Derive selected wallpaper objects for the chips list
    const selectedWallpaperData = useMemo(
        () => transformedWallpapers.filter(w => editor.selectedSet.has(w.path)),
        [transformedWallpapers, editor.selectedSet],
    )

    // True when every currently-visible wallpaper is already selected
    const allFilteredSelected = useMemo(
        () => filteredWallpapers.length > 0 && filteredWallpapers.every(w => editor.selectedSet.has(w.path)),
        [filteredWallpapers, editor.selectedSet],
    )

    // Stable overlay renderer — only re-creates when selection changes
    const renderCardOverlay = useCallback((wallpaper: Wallpaper) => {
        if (!editor.selectedSet.has(wallpaper.path)) return null
        return (
            <div className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary shadow-md shadow-black/30 ring-2 ring-primary-foreground/30 animate-in zoom-in-50 fade-in duration-150 ease-out motion-reduce:animate-none">
                <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
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

                {/* Search + filters + select-all */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                        <IconButton
                            icon={allFilteredSelected ? XCircle : CheckCheck}
                            size="sm"
                            pressed={allFilteredSelected}
                            onClick={() =>
                                allFilteredSelected
                                    ? editor.handleDeselectAll(filteredWallpapers.map(w => w.path))
                                    : editor.handleSelectAll(filteredWallpapers.map(w => w.path))
                            }
                            title={allFilteredSelected ? "Deselect All" : "Select All"}
                        />
                    </div>
                    <SearchInput className="flex-1 max-w-md" />
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
                isSelected={(w) => editor.selectedSet.has(w.path)}
                onCardClick={editor.handleToggleWallpaper}
                emptyMessage="No wallpapers found"
                emptySubMessage={searchQuery ? "Try a different search term" : "Install wallpapers first"}
                renderCardOverlay={renderCardOverlay}
            />
        </div>
    )
}
