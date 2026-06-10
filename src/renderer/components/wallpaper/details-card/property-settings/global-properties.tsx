import { SettingRow } from "@/components/settings/controls/setting-row-overlay"
import { GlobalOverrideControl, engineFieldDefault } from "./global-prop-variants"
import type { AppSettings } from "../../../../../shared/constants/app"
import { ENGINE_OVERRIDE_FIELDS, type WallpaperOverrides } from "../../../../../shared/constants/wallpaper"

interface GlobalOverridesProps {
    overrides: WallpaperOverrides | undefined
    settings: AppSettings | undefined
    onUpdate: <K extends keyof WallpaperOverrides>(key: K, value: WallpaperOverrides[K]) => void
    onClear: (key: keyof WallpaperOverrides) => void
}

// Presentational rows for the per-wallpaper engine flag overrides; state
// lives in the parent (wallpaper-settings).
export function GlobalProperties({ overrides, settings, onUpdate, onClear }: GlobalOverridesProps) {
    return (
        <>
            {ENGINE_OVERRIDE_FIELDS.map((field) => (
                <SettingRow
                    key={field.key}
                    label={field.label}
                    changed={overrides?.[field.key] !== undefined && overrides[field.key] !== engineFieldDefault(field, settings)}
                    onClear={() => onClear(field.key)}
                >
                    <GlobalOverrideControl
                        field={field}
                        overrides={overrides}
                        settings={settings}
                        onUpdate={onUpdate}
                    />
                </SettingRow>
            ))}
        </>
    )
}
