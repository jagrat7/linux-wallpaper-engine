import { useNavigate } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { ArrowLeft, Save, X, Plus, Clock, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/wallpaper/search"
import { FiltersDropdown } from "../wallpaper/filters-dropdown"
import { SortDropdown } from "../wallpaper/sort-dropdown"
import { WallpaperGridLayout } from "../wallpaper/wallpaper-grid-layout"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FieldLabel, FieldError } from "@/components/ui/field"
import {
    PLAYLIST_ORDER_OPTIONS,
    PLAYLIST_ORDER_VALUES,
    PLAYLIST_TIME_UNIT_OPTIONS,
    PLAYLIST_TIME_UNIT_VALUES,
    DEFAULT_PLAYLIST_SETTINGS,
    type Playlist,
    type PlaylistOrder,
    type PlaylistTimeUnit,
    type Wallpaper as WallpaperType,
} from "../../../shared/constants"
import { cn, delayToMinutes, minutesToDelay } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { useWallpapers, filterAndSortWallpapers } from "@/hooks/use-wallpapers"
import { useSearch } from "@/contexts/search-context"
import { useState, useEffect, useMemo } from "react"
import { z } from "zod"

// Form validation schema (different shape than backend playlist schema)
const playlistFormSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
    delay: z.number().min(1, "Must be at least 1"),
    timeUnit: z.enum(PLAYLIST_TIME_UNIT_VALUES),
    order: z.enum(PLAYLIST_ORDER_VALUES),
})

interface PlaylistEditorGridProps {
    editPlaylist?: Playlist | null
}

export function PlaylistEditorGrid({ editPlaylist }: PlaylistEditorGridProps) {
    const navigate = useNavigate()
    const { searchQuery, filterType, filterTags, filterResolution, sortBy, sortOrder, filterCompatibility } = useSearch()
    const [selectedWallpapers, setSelectedWallpapers] = useState<string[]>(editPlaylist?.items ?? [])
    const [serverError, setServerError] = useState<string | null>(null)

    const {
        wallpapers: transformedWallpapers,
        isLoading,
        compatibilityMap,
        appSettings,
    } = useWallpapers()

    const utils = trpc.useUtils()
    const createMutation = trpc.playlist.create.useMutation()
    const updateMutation = trpc.playlist.update.useMutation()

    const isEditing = !!editPlaylist

    // Convert engine minutes to UI-friendly value + unit for defaults
    const initialDelay = editPlaylist
        ? minutesToDelay(editPlaylist.settings.delay)
        : { value: DEFAULT_PLAYLIST_SETTINGS.delay, unit: "minutes" as PlaylistTimeUnit }

    const form = useForm({
        defaultValues: {
            name: editPlaylist?.name ?? "",
            delay: initialDelay.value,
            timeUnit: initialDelay.unit,
            order: editPlaylist?.settings.order ?? DEFAULT_PLAYLIST_SETTINGS.order,
            wallpapers: editPlaylist?.items ?? [] as string[],
        },
        validators: {
            onSubmit: playlistFormSchema.extend({
                wallpapers: z.array(z.string()).min(1, "Select at least 1 wallpaper"),
            }),
        },
        onSubmit: async ({ value }) => {

            const playlist: Playlist = {
                name: value.name.trim(),
                items: value.wallpapers,
                settings: {
                    ...DEFAULT_PLAYLIST_SETTINGS,
                    delay: delayToMinutes(value.delay, value.timeUnit),
                    order: value.order,
                },
            }

            const result = isEditing && editPlaylist
                ? await updateMutation.mutateAsync({ name: editPlaylist.name, playlist })
                : await createMutation.mutateAsync(playlist)

            if (result.success) {
                await utils.playlist.list.invalidate()
                navigate({ to: "/playlists" })
            } else {
                setServerError(result.error ?? "Failed to save playlist")
            }
        },
    })

    useEffect(() => {
        if (editPlaylist) {
            setSelectedWallpapers(editPlaylist.items)
            const parsed = minutesToDelay(editPlaylist.settings.delay)
            form.reset({
                name: editPlaylist.name,
                delay: parsed.value,
                timeUnit: parsed.unit,
                order: editPlaylist.settings.order,
                wallpapers: editPlaylist.items,
            })
        } else {
            setSelectedWallpapers([])
            form.reset({
                name: "",
                delay: DEFAULT_PLAYLIST_SETTINGS.delay,
                timeUnit: "minutes",
                order: DEFAULT_PLAYLIST_SETTINGS.order,
                wallpapers: [],
            })
        }
    }, [editPlaylist])

    const handleToggleWallpaper = (wallpaper: WallpaperType) => {
        const currentWallpapers = form.getFieldValue('wallpapers')
        const newSelection = currentWallpapers.includes(wallpaper.path)
            ? currentWallpapers.filter(p => p !== wallpaper.path)
            : [...currentWallpapers, wallpaper.path]

        form.setFieldValue('wallpapers', newSelection)
        setSelectedWallpapers(newSelection)
    }

    const handleRemoveWallpaper = (path: string) => {
        const currentWallpapers = form.getFieldValue('wallpapers')
        const newSelection = currentWallpapers.filter(p => p !== path)

        form.setFieldValue('wallpapers', newSelection)
        setSelectedWallpapers(newSelection)
    }

    const handleBack = () => {
        navigate({ to: "/playlists" })
    }

    // Apply filters and sorting from search context
    const filteredWallpapers: WallpaperType[] = useMemo(() =>
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
            <div className="absolute bottom-2 right-2 size-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary-foreground/20">
                <Check className="size-3.5 text-primary-foreground" />
            </div>
        )
    }

    const isSaving = form.state.isSubmitting

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
                            onClick={() => form.handleSubmit()}
                            className="gap-2"
                        >
                            <Save className="size-4" />
                            {isSaving ? "Saving..." : "Save Playlist"}
                        </Button>
                    </div>
                </div>

                {/* Playlist Settings Bar */}
                <div className="flex items-start gap-6 p-5 rounded-xl border border-border bg-card glass">
                    {/* Name */}
                    <form.Field
                        name="name"
                        children={(field) => {
                            const hasValidationError = field.state.meta.isTouched && !field.state.meta.isValid
                            const hasError = hasValidationError || !!serverError
                            return (
                                <div className="flex-1 space-y-2">
                                    <FieldLabel htmlFor={field.name}>Playlist Name</FieldLabel>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            field.handleChange(e.target.value)
                                            if (serverError) setServerError(null)
                                        }}
                                        aria-invalid={hasError}
                                        placeholder="My Playlist"
                                        className="h-9 max-w-md"
                                        autoComplete="off"
                                    />
                                    {hasValidationError && <FieldError errors={field.state.meta.errors} />}
                                    {serverError && <FieldError>{serverError}</FieldError>}
                                </div>
                            )
                        }}
                    />

                    {/* Delay + Time Unit */}
                    <div className="space-y-1.5">
                        <FieldLabel>Rotation Interval</FieldLabel>
                        <div className="flex items-start gap-1.5">
                            <form.Field
                                name="delay"
                                children={(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                    return (
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)}
                                                aria-invalid={isInvalid}
                                                className="h-9 w-16 scrollbar-styled"
                                            />
                                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                        </div>
                                    )
                                }}
                            />
                            <form.Field
                                name="timeUnit"
                                children={(field) => (
                                    <Select
                                        name={field.name}
                                        value={field.state.value}
                                        onValueChange={(v) => field.handleChange(v as PlaylistTimeUnit)}
                                    >
                                        <SelectTrigger className="h-9 w-20" >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="w-20">
                                            {PLAYLIST_TIME_UNIT_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>

                    {/* Order */}
                    <form.Field
                        name="order"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                            return (
                                <div className="space-y-1.5">
                                    <FieldLabel htmlFor={field.name}>Order</FieldLabel>
                                    <Select
                                        name={field.name}
                                        value={field.state.value}
                                        onValueChange={(v) => field.handleChange(v as PlaylistOrder)}
                                    >
                                        <SelectTrigger id={field.name} className="h-9 w-[7.5rem]" aria-invalid={isInvalid}>
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
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </div>
                            )
                        }}
                    />

                    {/* Wallpaper count + form-level error */}
                    <form.Field
                        name="wallpapers"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                            return (
                                <div className="space-y-1.5">
                                    <FieldLabel>Selected</FieldLabel>
                                    <div className={cn("flex h-9 items-center gap-2 rounded-md border border-transparent bg-secondary/20 px-3 text-sm text-muted-foreground", isInvalid && "bg-destructive/20 text-destructive")}>
                                        <Clock className="size-4" />
                                        <span className="font-medium">{selectedWallpapers.length} wallpapers</span>
                                    </div>
                                </div>
                            )
                        }}
                    />
                </div>

                {/* Selected Wallpapers Chips */}
                <AnimatePresence>
                    {selectedWallpapers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-1.5"
                        >
                            {selectedWallpaperData.map(wallpaper => (
                                <motion.div
                                    key={wallpaper.path}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-sm "
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
