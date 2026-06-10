import { Switch } from "@/components/ui/switch"
import { SelectControl } from "@/components/settings/controls/select-control"
import { SliderControl } from "@/components/settings/controls/slider-control"
import type { AppSettings } from "../../../../../shared/constants/app"
import type { EngineOverrideField, WallpaperOverrides } from "../../../../../shared/constants/wallpaper"
import type { ScalingOption } from "../../../../../shared/constants/display"

interface GlobalOverrideControlProps {
    field: EngineOverrideField
    overrides: WallpaperOverrides | undefined
    settings: AppSettings | undefined
    onUpdate: <K extends keyof WallpaperOverrides>(key: K, value: WallpaperOverrides[K]) => void
}

// The value a field shows when no override is stored
export const engineFieldDefault = (field: EngineOverrideField, settings: AppSettings | undefined) =>
    settings?.[field.globalKey] ?? field.fallback

// Renders the matching input for an engine override field. The effective
// value resolves override → global setting → static fallback; the chain is
// inlined per case so it narrows with `field.control` (engineFieldDefault
// returns the un-narrowed union).
export function GlobalOverrideControl({ field, overrides, settings, onUpdate }: GlobalOverrideControlProps) {
    switch (field.control) {
        case "select":
            return (
                <SelectControl
                    options={field.options}
                    value={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                    onChange={(value) => onUpdate(field.key, value as ScalingOption)}
                    triggerClassName="w-24"
                />
            )
        case "slider":
            return (
                <SliderControl
                    min={field.min}
                    max={field.max}
                    value={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                    onChange={(value) => onUpdate(field.key, value)}
                    suffix={field.suffix}
                />
            )
        case "switch":
            return (
                <Switch
                    checked={overrides?.[field.key] ?? settings?.[field.globalKey] ?? field.fallback}
                    onCheckedChange={(checked) => onUpdate(field.key, checked)}
                />
            )
    }
}
