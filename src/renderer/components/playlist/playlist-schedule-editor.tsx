import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import type { PlaylistMode, PlaylistScheduleEntry } from "../../../shared/constants/playlist"
import type { Wallpaper } from "../../../shared/constants/wallpaper"
import type { PlaylistEditorReturn } from "@/hooks/use-playlist-editor"

interface PlaylistScheduleEditorProps {
    form: PlaylistEditorReturn["form"]
    mode: PlaylistMode
    wallpapers: Wallpaper[]
}

export function PlaylistScheduleEditor({ form, mode, wallpapers }: PlaylistScheduleEditorProps) {
    const label = mode === "time" ? "Time" : "Theme"
    const firstWallpaper = wallpapers[0]?.path ?? ""

    return (
        <form.Field
            name="schedule"
            children={(field) => {
                const schedule = field.state.value
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                const updateEntry = (index: number, patch: Partial<PlaylistScheduleEntry>) => {
                    const next = schedule.map((entry, i) =>
                        i === index ? { ...entry, ...patch } : entry,
                    )
                    field.handleChange(next)
                }

                const addEntry = () => {
                    const base: PlaylistScheduleEntry = {
                        wallpaperPath: firstWallpaper,
                        time: mode === "time" ? "12:00" : undefined,
                        theme: mode === "theme" ? "light" : undefined,
                    }
                    field.handleChange([...schedule, base])
                }

                const removeEntry = (index: number) => {
                    field.handleChange(schedule.filter((_, i) => i !== index))
                }

                return (
                    <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">{label} Schedule</h4>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={addEntry}
                                disabled={!firstWallpaper}
                                className="h-8 gap-1"
                            >
                                <Plus className="size-4" />
                                Add Slot
                            </Button>
                        </div>

                        {schedule.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {mode === "time"
                                    ? "Add a time slot for each wallpaper you want at that time."
                                    : "Add a wallpaper for light and/or dark system theme."}
                            </p>
                        )}

                        <div className="flex flex-col gap-2">
                            {schedule.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    {mode === "time" && (
                                        <input
                                            type="time"
                                            value={entry.time ?? ""}
                                            onChange={(e) => updateEntry(index, { time: e.target.value })}
                                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                        />
                                    )}

                                    {mode === "theme" && (
                                        <Select
                                            value={entry.theme ?? ""}
                                            onValueChange={(v) => updateEntry(index, { theme: v as "light" | "dark" })}
                                        >
                                            <SelectTrigger className="h-9 w-28">
                                                <SelectValue placeholder="Theme" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="light">Light</SelectItem>
                                                <SelectItem value="dark">Dark</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}

                                    <Select
                                        value={entry.wallpaperPath}
                                        onValueChange={(v) => updateEntry(index, { wallpaperPath: v })}
                                    >
                                        <SelectTrigger className="h-9 flex-1 min-w-0">
                                            <SelectValue placeholder="Select wallpaper" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {wallpapers.map((wallpaper) => (
                                                <SelectItem key={wallpaper.path} value={wallpaper.path}>
                                                    {wallpaper.title ?? wallpaper.path.split("/").pop() ?? "Wallpaper"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => removeEntry(index)}
                                        className="size-8 shrink-0"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </div>
                )
            }}
        />
    )
}
