import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Save, X, Plus, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "../wallpaper/filters-dropdown"
import { SortDropdown } from "../wallpaper/sort-dropdown"
import { WallpaperGridLayout } from "../wallpaper/wallpaper-grid-layout"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PLAYLIST_ORDER_OPTIONS, DEFAULT_PLAYLIST_SETTINGS, type Playlist, type PlaylistSettings, type Wallpaper as WallpaperType } from "../../../shared/constants"
import { trpc } from "@/lib/trpc"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useSearch } from "@/contexts/search-context"

interface PlaylistEditorGridProps {
    editPlaylist?: Playlist | null
}

export function PlaylistEditorGrid({ editPlaylist }: PlaylistEditorGridProps) {
    const navigate = useNavigate()
    const { searchQuery, filterType, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility } = useSearch()

    const [name, setName] = React.useState(editPlaylist?.name ?? "")
    const [selectedWallpapers, setSelectedWallpapers] = React.useState<string[]>(editPlaylist?.items ?? [])
    const [settings, setSettings] = React.useState<PlaylistSettings>(editPlaylist?.settings ?? DEFAULT_PLAYLIST_SETTINGS)
    const [isSaving, setIsSaving] = React.useState(false)

    const {
        wallpapers: transformedWallpapers,
        isLoading,
        compatibilityMap,
        appSettings,
    } = useWallpapers()

    const createMutation = trpc.playlist.create.useMutation()
    const updateMutation = trpc.playlist.update.useMutation()

    const isEditing = !!editPlaylist

    React.useEffect(() => {
        if (editPlaylist) {
            setName(editPlaylist.name)
            setSelectedWallpapers(editPlaylist.items)
            setSettings(editPlaylist.settings)
        } else {
            setName("")
            setSelectedWallpapers([])
            setSettings(DEFAULT_PLAYLIST_SETTINGS)
        }
    }, [editPlaylist])

    const handleToggleWallpaper = (wallpaper: WallpaperType) => {
        setSelectedWallpapers(prev =>
            prev.includes(wallpaper.path)
                ? prev.filter(p => p !== wallpaper.path)
                : [...prev, wallpaper.path]
        )
    }

    const handleRemoveWallpaper = (path: string) => {
        setSelectedWallpapers(prev => prev.filter(p => p !== path))
    }

    const handleSave = async () => {
        if (!name.trim() || selectedWallpapers.length === 0) return

        setIsSaving(true)
        const playlist: Playlist = {
            name: name.trim(),
            items: selectedWallpapers,
            settings,
        }

        try {
            if (isEditing && editPlaylist) {
                const result = await updateMutation.mutateAsync({
                    name: editPlaylist.name,
                    playlist,
                })
                if (result.success) {
                    navigate({ to: "/playlists" })
                }
            } else {
                const result = await createMutation.mutateAsync(playlist)
                if (result.success) {
                    navigate({ to: "/playlists" })
                }
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleBack = () => {
        navigate({ to: "/playlists" })
    }

    // Apply filters and sorting from search context
    const filteredWallpapers: WallpaperType[] = React.useMemo(() =>
        filterAndSortWallpapers(transformedWallpapers, {
            filterType,
            filterTags,
            filterResolution,
            filterCompatibility,
            sortBy,
            sortOrder,
            compatibilityMap,
        }),
        [transformedWallpapers, filterType, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility, compatibilityMap])

    const selectedWallpaperData = transformedWallpapers.filter(w => selectedWallpapers.includes(w.path))

    const renderCardOverlay = (wallpaper: WallpaperType) => {
        const isSelected = selectedWallpapers.includes(wallpaper.path)
        if (!isSelected) return null
        return (
            <div className="absolute top-2 right-2 size-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary-foreground/20">
                <Plus className="size-3.5 text-primary-foreground rotate-45" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon-sm" onClick={handleBack}>
                            <ArrowLeft className="size-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">
                                {isEditing ? "Edit Playlist" : "New Playlist"}
                            </h1>
                            <p className="text-muted-foreground">
                                Select wallpapers to add to your playlist
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim() || selectedWallpapers.length === 0 || isSaving}
                            className="gap-2"
                        >
                            <Save className="size-4" />
                            {isSaving ? "Saving..." : "Save Playlist"}
                        </Button>
                    </div>
                </div>

                {/* Playlist Settings Bar */}
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card glass">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium">Playlist Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Playlist"
                            className="max-w-xs"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rotation Interval</label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={1}
                                value={settings.delay}
                                onChange={(e) => setSettings(s => ({ ...s, delay: parseInt(e.target.value) ?? 60 }))}
                                className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">minutes</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Order</label>
                        <Select
                            value={settings.order}
                            onValueChange={(value) => setSettings(s => ({ ...s, order: value as 'sequential' | 'random' }))}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PLAYLIST_ORDER_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4" />
                        <span>{selectedWallpapers.length} wallpapers</span>
                    </div>
                </div>

                {/* Selected Wallpapers Chips */}
                <AnimatePresence>
                    {selectedWallpapers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-2"
                        >
                            {selectedWallpaperData.map(wallpaper => (
                                <motion.div
                                    key={wallpaper.path}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-sm"
                                >
                                    <span className="max-w-[150px] truncate font-medium">
                                        {wallpaper.title}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="size-5 p-0 hover:bg-destructive/20 hover:text-destructive"
                                        onClick={() => handleRemoveWallpaper(wallpaper.path)}
                                    >
                                        <X className="size-3" />
                                    </Button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search */}
                <div className="flex items-center gap-3 max-w-xl">
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

            {/* Grid */}
            <WallpaperGridLayout
                wallpapers={filteredWallpapers}
                isLoading={isLoading}
                compatibilityMap={compatibilityMap}
                showCompatibilityDot={appSettings?.showCompatibilityDot ?? true}
                onCardClick={handleToggleWallpaper}
                emptyMessage="No wallpapers found"
                emptySubMessage={searchQuery ? "Try a different search term" : "Install wallpapers first"}
                renderCardOverlay={renderCardOverlay}
            />
        </div>
    )
}
