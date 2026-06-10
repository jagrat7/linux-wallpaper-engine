import { useNavigate } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { useState, useEffect, useMemo, useCallback } from "react"
import { z } from "zod"
import {
    PLAYLIST_ORDER_VALUES,
    PLAYLIST_TIME_UNIT_VALUES,
    DEFAULT_PLAYLIST_SETTINGS,
    type Playlist,
    type PlaylistTimeUnit,
} from "../../shared/constants/playlist"
import { engineOverridesSchema, type Wallpaper, type WallpaperOverrides } from "../../shared/constants/wallpaper"
import { delayToMinutes, minutesToDelay } from "@/lib/utils"
import { trpc } from "@/lib/trpc"

const playlistFormSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
    delay: z.number().min(1, "Must be at least 1"),
    timeUnit: z.enum(PLAYLIST_TIME_UNIT_VALUES),
    order: z.enum(PLAYLIST_ORDER_VALUES),
    overrides: engineOverridesSchema,
})

const fullSchema = playlistFormSchema.extend({
    wallpapers: z.array(z.string()).min(1, "Select at least 1 wallpaper"),
})

/** Build form defaults from a playlist, or fall back to factory defaults. */
function buildDefaults(playlist?: Playlist | null) {
    if (playlist) {
        const parsed = minutesToDelay(playlist.settings.delay)
        return {
            name: playlist.name,
            delay: parsed.value,
            timeUnit: parsed.unit,
            order: playlist.settings.order,
            overrides: (playlist.settings.overrides ?? {}) as WallpaperOverrides,
            wallpapers: playlist.items,
        }
    }
    return {
        name: "",
        delay: DEFAULT_PLAYLIST_SETTINGS.delay,
        timeUnit: "minutes" as PlaylistTimeUnit,
        order: DEFAULT_PLAYLIST_SETTINGS.order,
        overrides: {} as WallpaperOverrides,
        wallpapers: [] as string[],
    }
}

export function usePlaylistEditor(editPlaylist?: Playlist | null) {
    const navigate = useNavigate()
    const utils = trpc.useUtils()
    const createMutation = trpc.playlist.create.useMutation()
    const updateMutation = trpc.playlist.update.useMutation()

    const isEditing = !!editPlaylist
    const [selectedPaths, setSelectedPaths] = useState<string[]>(editPlaylist?.items ?? [])
    const [serverError, setServerError] = useState<string | null>(null)

    const form = useForm({
        defaultValues: buildDefaults(editPlaylist),
        validators: { onSubmit: fullSchema },
        onSubmit: async ({ value }) => {
            const playlist: Playlist = {
                name: value.name.trim(),
                items: value.wallpapers,
                settings: {
                    ...DEFAULT_PLAYLIST_SETTINGS,
                    delay: delayToMinutes(value.delay, value.timeUnit),
                    order: value.order,
                    overrides: value.overrides,
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

    // Sync local + form state when the source playlist changes
    useEffect(() => {
        const defaults = buildDefaults(editPlaylist)
        setSelectedPaths(defaults.wallpapers)
        form.reset(defaults)
    }, [editPlaylist])

    // O(1) lookup for selection checks
    const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths])


    const handleToggleWallpaper = useCallback((wallpaper: Wallpaper) => {
        setSelectedPaths(prev => {
            const next = prev.includes(wallpaper.path)
                ? prev.filter(p => p !== wallpaper.path)
                : [...prev, wallpaper.path]
            form.setFieldValue("wallpapers", next)
            return next
        })
    }, [form])

    const handleRemoveWallpaper = useCallback((path: string) => {
        setSelectedPaths(prev => {
            const next = prev.filter(p => p !== path)
            form.setFieldValue("wallpapers", next)
            return next
        })
    }, [form])

    const handleSelectAll = useCallback((paths: string[]) => {
        setSelectedPaths(prev => {
            const merged = Array.from(new Set([...prev, ...paths]))
            form.setFieldValue("wallpapers", merged)
            return merged
        })
    }, [form])

    const handleDeselectAll = useCallback((paths: string[]) => {
        const pathSet = new Set(paths)
        setSelectedPaths(prev => {
            const next = prev.filter(p => !pathSet.has(p))
            form.setFieldValue("wallpapers", next)
            return next
        })
    }, [form])

    const handleBack = useCallback(() => {
        navigate({ to: "/playlists" })
    }, [navigate])

    const clearServerError = useCallback(() => {
        if (serverError) setServerError(null)
    }, [serverError])

    return {
        form,
        isEditing,
        selectedPaths,
        selectedSet,
        serverError,
        clearServerError,
        isSaving: form.state.isSubmitting,
        handleToggleWallpaper,
        handleRemoveWallpaper,
        handleSelectAll,
        handleDeselectAll,
        handleBack,
    }
}

export type PlaylistEditorReturn = ReturnType<typeof usePlaylistEditor>
