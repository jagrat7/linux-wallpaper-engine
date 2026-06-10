import { ChevronDown, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FieldLabel, FieldError } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    PLAYLIST_ORDER_OPTIONS,
    PLAYLIST_TIME_UNIT_OPTIONS,
    type PlaylistOrder,
    type PlaylistTimeUnit,
} from "../../../shared/constants/playlist"
import { ENGINE_OVERRIDE_FIELDS, type WallpaperOverrides } from "../../../shared/constants/wallpaper"
import { GlobalProperties } from "../wallpaper/details-card/property-settings/global-properties"
import { engineFieldDefault } from "../wallpaper/details-card/property-settings/global-prop-variants"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import type { PlaylistEditorReturn } from "@/hooks/use-playlist-editor"

interface PlaylistSettingsBarProps {
    form: PlaylistEditorReturn["form"]
    selectedCount: number
    serverError: string | null
    onClearServerError: () => void
}

// Matches SelectTrigger so popover fields sit flush with adjacent selects
const selectTriggerClassName =
    "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export function PlaylistSettingsBar({ form, selectedCount, serverError, onClearServerError }: PlaylistSettingsBarProps) {
    // Global settings supply the fallback values shown for unset overrides
    const { data: settings } = trpc.settings.get.useQuery()

    return (
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
                                    onClearServerError()
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

            {/* Rotation interval: delay value + time unit */}
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
                                <SelectTrigger className="h-9 w-20">
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
                                <SelectTrigger id={field.name} className="h-9 w-30" aria-invalid={isInvalid}>
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

            {/* Engine setting overrides for the whole playlist */}
            <form.Field
                name="overrides"
                children={(field) => {
                    const overrides = field.state.value
                    const activeCount = ENGINE_OVERRIDE_FIELDS.filter(
                        (f) => overrides?.[f.key] !== undefined && overrides[f.key] !== engineFieldDefault(f, settings),
                    ).length

                    const clearOverride = (key: keyof WallpaperOverrides) => {
                        const next = { ...overrides }
                        delete next[key]
                        field.handleChange(next)
                    }

                    const updateOverride = <K extends keyof WallpaperOverrides>(key: K, value: WallpaperOverrides[K]) => {
                        // Storing a value equal to the effective default is the same as unsetting it
                        const f = ENGINE_OVERRIDE_FIELDS.find((o) => o.key === key)
                        if (f && value === engineFieldDefault(f, settings)) {
                            clearOverride(key)
                            return
                        }
                        field.handleChange({ ...overrides, [key]: value })
                    }

                    return (
                        <div className="space-y-1.5">
                            <FieldLabel>Overrides</FieldLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            selectTriggerClassName,
                                            "w-30",
                                            activeCount === 0 && "text-muted-foreground",
                                        )}
                                    >
                                        <span className="truncate">
                                            {activeCount > 0 ? "Custom" : "Default"}
                                        </span>
                                        <ChevronDown className="size-4 opacity-50" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" sideOffset={4} className="w-80 p-1">
                                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                        Override global settings for this playlist. Unset values use global defaults.
                                    </p>
                                    <GlobalProperties
                                        overrides={overrides}
                                        settings={settings}
                                        onUpdate={updateOverride}
                                        onClear={clearOverride}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )
                }}
            />

            {/* Selected count badge */}
            <form.Field
                name="wallpapers"
                children={(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                        <div className="space-y-1.5">
                            <FieldLabel>Selected</FieldLabel>
                            <div className={cn(
                                "flex h-9 items-center gap-2 rounded-md border border-transparent bg-secondary/20 px-3 text-sm text-muted-foreground",
                                isInvalid && "bg-destructive/20 text-destructive",
                            )}>
                                <Clock className="size-4" />
                                <span className="font-medium">{selectedCount} wallpapers</span>
                            </div>
                        </div>
                    )
                }}
            />
        </div>
    )
}
