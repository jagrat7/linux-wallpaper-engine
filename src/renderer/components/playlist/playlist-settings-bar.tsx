import { Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FieldLabel, FieldError } from "@/components/ui/field"
import {
    PLAYLIST_ORDER_OPTIONS,
    PLAYLIST_TIME_UNIT_OPTIONS,
    type PlaylistOrder,
    type PlaylistTimeUnit,
} from "../../../shared/constants/playlist"
import { cn } from "@/lib/utils"
import type { PlaylistEditorReturn } from "@/hooks/use-playlist-editor"

interface PlaylistSettingsBarProps {
    form: PlaylistEditorReturn["form"]
    selectedCount: number
    serverError: string | null
    onClearServerError: () => void
}

export function PlaylistSettingsBar({ form, selectedCount, serverError, onClearServerError }: PlaylistSettingsBarProps) {
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
