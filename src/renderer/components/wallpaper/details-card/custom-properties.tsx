import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingRow } from "@/components/settings/controls/setting-row"
import { SelectControl } from "@/components/settings/controls/select-control"
import { SliderControl } from "@/components/settings/controls/slider-control"
import { ColorControl } from "@/components/settings/controls/color-control"
import { trpc } from "@/lib/trpc"
import type { WallpaperProperty } from "../../../../shared/constants/wallpaper"

interface CustomPropertiesProps {
    wallpaperPath: string
    values: Record<string, string> | undefined
    onChange: (values: Record<string, string> | undefined) => void
}

// Labels arrive as HTML fragments (`<strong>Label:</strong>`), localization keys,
// or author shorthand like "rain on/off" — normalize to clean title-cased text.
function cleanLabel(text: string, fallback: string): string {
    const cleaned = text.replace(/<[^>]+>/g, "").trim()
    const base = !cleaned || cleaned.startsWith("ui_") ? fallback : cleaned
    return base
        .replace(/\s*\bon\s*\/\s*off\b/gi, "")
        .replace(/[\s:]+$/, "")
        .replace(/(^|\s)([a-z])/g, (_, space: string, letter: string) => space + letter.toUpperCase())
        .trim() || fallback
}

// Color properties use space-separated float triplets in 0-1 range ("0.14 0.23 0.4").
function propertyColorToHex(value: string): string {
    const channel = (f: number) =>
        Math.round(Math.min(Math.max(f, 0), 1) * 255).toString(16).padStart(2, "0")
    const [r, g, b] = value.split(/[\s,]+/).map(Number)
    return `#${channel(r || 0)}${channel(g || 0)}${channel(b || 0)}`
}

function hexToPropertyColor(hex: string): string {
    // 5 decimals matches the precision wallpapers ship in project.json and
    // round-trips through propertyColorToHex back to the same hex value.
    return [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((f) => String(Number(f.toFixed(5))))
        .join(" ")
}

export function CustomProperties({ wallpaperPath, values, onChange }: CustomPropertiesProps) {
    const { data: properties } = trpc.wallpaper.listProperties.useQuery(
        { path: wallpaperPath },
        { enabled: Boolean(wallpaperPath) }
    )

    if (!properties || properties.length === 0) return null

    const setValue = (name: string, value: string | undefined) => {
        const updated = { ...values }
        if (value === undefined) {
            delete updated[name]
        } else {
            updated[name] = value
        }
        onChange(Object.keys(updated).length > 0 ? updated : undefined)
    }

    return (
        <div className="space-y-1">
            <p className="px-1 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                Wallpaper properties
            </p>
            {properties.map((prop) => (
                <PropertyRow
                    key={prop.name}
                    property={prop}
                    value={values?.[prop.name]}
                    onChange={(v) => setValue(prop.name, v)}
                />
            ))}
        </div>
    )
}

interface PropertyRowProps {
    property: WallpaperProperty
    value: string | undefined
    onChange: (value: string | undefined) => void
}

function PropertyRow({ property, value, onChange }: PropertyRowProps) {
    const effective = value ?? property.value
    const label = cleanLabel(property.text, property.name)
    const changed = value !== undefined
    const clear = () => onChange(undefined)

    return (
        <SettingRow label={label} changed={changed} onClear={clear}>
            <PropertyControl property={property} value={effective} onChange={onChange} />
        </SettingRow>
    )
}

function PropertyControl({ property, value, onChange }: { property: WallpaperProperty; value: string; onChange: (v: string) => void }) {
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
