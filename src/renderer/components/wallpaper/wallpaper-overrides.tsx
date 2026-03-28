import { ChevronDown, RotateCcw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SettingRow } from "@/components/settings/setting-row"
import { type Wallpaper } from "./wallpaper-card"
import { trpc } from "@/lib/trpc"
import type { WallpaperOverrides } from "../../../shared/constants/wallpaper"
import { SCALING_OPTIONS } from "../../../shared/constants/display"

interface WallpaperOverridesProps {
    wallpaper: Wallpaper
}
// TODO: make it dynamic for a given wallpaper
export function WallpaperOverrides({ wallpaper }: WallpaperOverridesProps) {
    const utils = trpc.useUtils()

    // Fetch per-wallpaper overrides
    const { data: overrides } = trpc.wallpaper.getOverrides.useQuery(
        { path: wallpaper.path ?? "" },
        { enabled: Boolean(wallpaper.path) }
    )

    // Fetch global settings for fallback display
    const { data: settings } = trpc.settings.get.useQuery()

    const queryKey = { path: wallpaper.path ?? "" }

    const saveMutation = trpc.wallpaper.saveOverrides.useMutation({
        onMutate: async ({ overrides: newOverrides }) => {
            await utils.wallpaper.getOverrides.cancel(queryKey)
            utils.wallpaper.getOverrides.setData(queryKey, newOverrides)
        },
    })

    const resetMutation = trpc.wallpaper.resetOverrides.useMutation({
        onMutate: async () => {
            await utils.wallpaper.getOverrides.cancel(queryKey)
            utils.wallpaper.getOverrides.setData(queryKey, {})
        },
    })

    const updateOverride = <K extends keyof WallpaperOverrides>(key: K, value: WallpaperOverrides[K]) => {
        const updated = { ...overrides, [key]: value }
        saveMutation.mutate({ path: wallpaper.path ?? "", overrides: updated })
    }

    const clearOverride = (key: keyof WallpaperOverrides) => {
        const updated = { ...overrides }
        delete updated[key]
        saveMutation.mutate({ path: wallpaper.path ?? "", overrides: updated })
    }

    const handleReset = () => {
        resetMutation.mutate({ path: wallpaper.path ?? "" })
    }

    const hasOverrides = overrides && Object.keys(overrides).length > 0

    // Helper to get effective value (override ?? global setting)
    const getValue = <K extends keyof WallpaperOverrides>(key: K): WallpaperOverrides[K] | undefined => {
        return overrides?.[key]
    }

    const getGlobalValue = (key: string) => {
        if (!settings) return undefined
        const map: Record<string, unknown> = {
            volume: settings.volume,
            audioProcessing: settings.audioProcessing,
            scaling: settings.defaultScaling,
            disableMouse: settings.disableMouse,
            disableParallax: settings.disableParallax,
        }
        return map[key]
    }

    return (
        <Collapsible className="mt-4 border-t border-border pt-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium [&[data-state=open]>svg]:rotate-180">
                <span className="flex items-center gap-2 text-muted-foreground"><Settings className="size-4" />Settings</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform" />
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="mt-3 space-y-1">
                    <p className="px-1 pb-2 text-xs text-muted-foreground">
                        Override global settings for this wallpaper. Unset values use global defaults.
                    </p>

                    {/* Scaling */}
                    <SettingRow
                        label="Scaling"
                        changed={getValue("scaling") !== undefined}
                        onClear={() => clearOverride("scaling")}
                    >
                        <Select
                            value={getValue("scaling") ?? String(getGlobalValue("scaling") ?? "fill")}
                            onValueChange={(value) => updateOverride("scaling", value as WallpaperOverrides["scaling"])}
                        >
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SCALING_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {/* Volume */}
                    <SettingRow
                        label="Volume"
                        changed={getValue("volume") !== undefined}
                        onClear={() => clearOverride("volume")}
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={getValue("volume") ?? (getGlobalValue("volume") as number | undefined) ?? 100}
                                onChange={(e) => updateOverride("volume", Number(e.target.value))}
                                className="w-24 accent-primary"
                            />
                            <span className="w-10 text-right text-xs text-muted-foreground">
                                {getValue("volume") ?? (getGlobalValue("volume") as number | undefined) ?? 100}%
                            </span>
                        </div>
                    </SettingRow>

                    {/* Audio processing */}
                    <SettingRow
                        label="Audio reactive effects"
                        changed={getValue("audioProcessing") !== undefined}
                        onClear={() => clearOverride("audioProcessing")}
                    >
                        <Switch
                            checked={getValue("audioProcessing") ?? (getGlobalValue("audioProcessing") as boolean | undefined) ?? true}
                            onCheckedChange={(checked) => updateOverride("audioProcessing", checked)}
                        />
                    </SettingRow>

                    {/* Disable mouse */}
                    <SettingRow
                        label="Disable mouse interaction"
                        changed={getValue("disableMouse") !== undefined}
                        onClear={() => clearOverride("disableMouse")}
                    >
                        <Switch
                            checked={getValue("disableMouse") ?? (getGlobalValue("disableMouse") as boolean | undefined) ?? false}
                            onCheckedChange={(checked) => updateOverride("disableMouse", checked)}
                        />
                    </SettingRow>

                    {/* Disable parallax */}
                    <SettingRow
                        label="Disable parallax effect"
                        changed={getValue("disableParallax") !== undefined}
                        onClear={() => clearOverride("disableParallax")}
                    >
                        <Switch
                            checked={getValue("disableParallax") ?? (getGlobalValue("disableParallax") as boolean | undefined) ?? false}
                            onCheckedChange={(checked) => updateOverride("disableParallax", checked)}
                        />
                    </SettingRow>

                    {hasOverrides && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full gap-2 text-muted-foreground"
                            onClick={handleReset}
                            disabled={resetMutation.isPending}
                        >
                            <RotateCcw className="size-3.5" />
                            Reset to Global Defaults
                        </Button>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
