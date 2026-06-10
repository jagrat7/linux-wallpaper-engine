import { SettingRow } from "@/components/settings/controls/setting-row-overlay"
import { cleanLabel, propertyColorToHex } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { PropertyControl } from "./custom-prop-variants"

interface CustomPropertiesProps {
    wallpaperPath: string
    values: Record<string, string> | undefined
    onChange: (values: Record<string, string> | undefined) => void
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
            {properties.map((property) => {
                // Colors compare in hex form: the author default and the picker
                // can serialize the same color with different float precision.
                const isDefault = (v: string) =>
                    property.type === "color"
                        ? propertyColorToHex(v) === propertyColorToHex(property.value)
                        : v === property.value

                const value = values?.[property.name]
                const changed = value !== undefined && !isDefault(value)

                return (
                    <SettingRow
                        key={property.name}
                        label={cleanLabel(property.text, property.name)}
                        changed={changed}
                        onClear={() => setValue(property.name, undefined)}
                    >
                        <PropertyControl
                            property={property}
                            value={value ?? property.value}
                            onChange={(v) => setValue(property.name, isDefault(v) ? undefined : v)}
                        />
                    </SettingRow>
                )
            })}
        </div>
    )
}
