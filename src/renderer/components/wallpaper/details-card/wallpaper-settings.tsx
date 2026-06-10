import { RotateCcw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { GlobalProperties } from "./property-settings/global-properties"
import { engineFieldDefault } from "./property-settings/global-prop-variants"
import { CustomProperties } from "./property-settings/custom-properties"
import { type Wallpaper } from "../wallpaper-card"
import { ENGINE_OVERRIDE_FIELDS, isScanManagedKey, type WallpaperOverrides } from "../../../../shared/constants/wallpaper"

interface WallpaperSettingsProps {
    wallpaper: Wallpaper
}

// Owns the per-wallpaper override state (queries + mutations) and assembles
// the engine flag overrides and custom wallpaper properties sections.
export function WallpaperSettings({ wallpaper }: WallpaperSettingsProps) {
    const utils = trpc.useUtils()
    const queryKey = { path: wallpaper.path ?? "" }

    const { data: overrides } = trpc.wallpaper.getOverrides.useQuery(
        queryKey,
        { enabled: Boolean(wallpaper.path) }
    )

    // Global settings provide the fallback values unset fields display
    const { data: settings } = trpc.settings.get.useQuery()

    // Optimistic updates: apply immediately, roll back to the snapshot if the
    // mutation fails, and refetch on settle so the cache picks up server-side
    // merges (the scan-managed fields the tRPC schema strips from the input)
    const saveMutation = trpc.wallpaper.saveOverrides.useMutation({
        onMutate: async ({ overrides: newOverrides }) => {
            await utils.wallpaper.getOverrides.cancel(queryKey)
            const previous = utils.wallpaper.getOverrides.getData(queryKey)
            utils.wallpaper.getOverrides.setData(queryKey, newOverrides)
            return { previous }
        },
        onError: (_error, _variables, context) => {
            utils.wallpaper.getOverrides.setData(queryKey, context?.previous)
        },
        onSettled: () => utils.wallpaper.getOverrides.invalidate(queryKey),
    })

    const resetMutation = trpc.wallpaper.resetOverrides.useMutation({
        onMutate: async () => {
            await utils.wallpaper.getOverrides.cancel(queryKey)
            const previous = utils.wallpaper.getOverrides.getData(queryKey)
            utils.wallpaper.getOverrides.setData(queryKey, {})
            return { previous }
        },
        onError: (_error, _variables, context) => {
            utils.wallpaper.getOverrides.setData(queryKey, context?.previous)
        },
        onSettled: () => utils.wallpaper.getOverrides.invalidate(queryKey),
    })

    const updateOverride = <K extends keyof WallpaperOverrides>(key: K, value: WallpaperOverrides[K]) => {
        // Storing a value equal to the effective default is the same as unsetting it
        const field = ENGINE_OVERRIDE_FIELDS.find((f) => f.key === key)
        if (field && value === engineFieldDefault(field, settings)) {
            clearOverride(key)
            return
        }
        saveMutation.mutate({ path: wallpaper.path ?? "", overrides: { ...overrides, [key]: value } })
    }

    const clearOverride = (key: keyof WallpaperOverrides) => {
        const updated = { ...overrides }
        delete updated[key]
        saveMutation.mutate({ path: wallpaper.path ?? "", overrides: updated })
    }

    // Scan results share the overrides record but aren't user overrides — they
    // shouldn't summon the Reset button on their own
    const hasOverrides = overrides && Object.keys(overrides).some((key) => !isScanManagedKey(key))

    return (
        <div className="mt-4 border-t border-border pt-4">
            <div className="flex w-full items-center text-sm font-medium">
                <span className="flex items-center gap-2 text-muted-foreground"><Settings className="size-4" />Settings</span>
            </div>

            <div className="mt-3 space-y-1">
                <p className="px-1 pb-2 text-xs text-muted-foreground">
                    Override global settings for this wallpaper. Unset values use global defaults.
                </p>

                <GlobalProperties
                    overrides={overrides}
                    settings={settings}
                    onUpdate={updateOverride}
                    onClear={clearOverride}
                />

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
                        onClick={() => resetMutation.mutate({ path: wallpaper.path ?? "" })}
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
