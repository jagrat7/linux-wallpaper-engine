import { RotateCcw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SettingRow } from "@/components/settings/controls/setting-row"
import { SelectControl } from "@/components/settings/controls/select-control"
import { SliderControl } from "@/components/settings/controls/slider-control"
import { CustomProperties } from "./custom-properties"
import { type Wallpaper } from "../wallpaper-card"
import { trpc } from "@/lib/trpc"
import { ENGINE_OVERRIDE_FIELDS, type EngineOverrideField, type WallpaperOverrides } from "../../../../shared/constants/wallpaper"
import type { ScalingOption } from "../../../../shared/constants/display"

interface WallpaperOverridesProps {
    wallpaper: Wallpaper
}

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

    const renderControl = (field: EngineOverrideField) => {
        switch (field.control) {
            case "select":
                return (
                    <SelectControl
                        options={field.options}
                        value={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                        onChange={(value) => updateOverride(field.key, value as ScalingOption)}
                        triggerClassName="w-24"
                    />
                )
            case "slider":
                return (
                    <SliderControl
                        min={field.min}
                        max={field.max}
                        value={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                        onChange={(value) => updateOverride(field.key, value)}
                        suffix={field.suffix}
                    />
                )
            case "switch":
                return (
                    <Switch
                        checked={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                        onCheckedChange={(checked) => updateOverride(field.key, checked)}
                    />
                )
        }
    }

    return (
        <div className="mt-4 border-t border-border pt-4">
            <div className="flex w-full items-center text-sm font-medium">
                <span className="flex items-center gap-2 text-muted-foreground"><Settings className="size-4" />Settings</span>
            </div>

            <div className="mt-3 space-y-1">
                    <p className="px-1 pb-2 text-xs text-muted-foreground">
                        Override global settings for this wallpaper. Unset values use global defaults.
                    </p>

                    {ENGINE_OVERRIDE_FIELDS.map((field) => (
                        <SettingRow
                            key={field.key}
                            label={field.label}
                            changed={overrides?.[field.key] !== undefined}
                            onClear={() => clearOverride(field.key)}
                        >
                            {renderControl(field)}
                        </SettingRow>
                    ))}

                    {/* Per-wallpaper custom properties (--set-property) */}
                    <CustomProperties
                        wallpaperPath={wallpaper.path ?? ""}
                        values={overrides?.customProperties}
                        onChange={(values) =>
                            values ? updateOverride("customProperties", values) : clearOverride("customProperties")
                        }
                    />

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
        </div>
    )
}
