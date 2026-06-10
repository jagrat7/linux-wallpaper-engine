import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SelectControl } from "@/components/settings/controls/select-control"
import { SliderControl } from "@/components/settings/controls/slider-control"
import { ColorControl } from "@/components/settings/controls/color-control"
import { cleanLabel, hexToPropertyColor, propertyColorToHex } from "@/lib/utils"
import type { WallpaperProperty } from "../../../../../shared/constants/wallpaper"

interface PropertyControlProps {
    property: WallpaperProperty
    value: string
    onChange: (value: string) => void
}

// Renders the matching input for a property type; `value` is the effective
// (user or author-default) value and `onChange` receives the raw new value.
export function PropertyControl({ property, value, onChange }: PropertyControlProps) {
    switch (property.type) {
        case "bool":
            return (
                <Switch
                    checked={value !== "0" && value !== "false" && value !== ""}
                    onCheckedChange={(checked) => onChange(checked ? "1" : "0")}
                />
            )

        case "slider": {
            const min = property.min ?? 0
            const max = property.max ?? Math.max(min + 1, Number(value) || 0)
            const step = property.step && property.step > 0 ? property.step : (max - min) / 100
            return (
                <SliderControl
                    min={min}
                    max={max}
                    step={step}
                    value={Number(value) || 0}
                    onChange={(v) => onChange(String(v))}
                />
            )
        }

        case "combo":
            return (
                <SelectControl
                    options={(property.options ?? []).map((option) => ({
                        label: cleanLabel(option.label, option.value),
                        value: option.value,
                    }))}
                    value={value}
                    onChange={onChange}
                    triggerClassName="w-36"
                />
            )

        case "color":
            return (
                <ColorControl
                    value={propertyColorToHex(value)}
                    onChange={(hex) => onChange(hexToPropertyColor(hex))}
                />
            )

        case "textinput":
            return (
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-36 text-xs"
                />
            )
    }
}
