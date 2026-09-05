import { createFileRoute } from "@tanstack/react-router"
import {
    Settings,
    Volume2,
    Monitor,
    Palette,
    RotateCcw,
    Loader2,
    ScanSearch,
    ChevronDown,
    Check,
    Grid3x3,
    Grid2x2,
    Square,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingRow } from "@/components/settings/controls/setting-row-overlay"
import { SelectControl } from "@/components/settings/controls/select-control"
import { SliderControl } from "@/components/settings/controls/slider-control"
import { trpc } from "@/lib/trpc"
import { useTheme } from "@/components/theme-provider"
import { THEME_OPTIONS } from "../../shared/constants/theme"
import { SCALING_OPTIONS } from "../../shared/constants/display"
import { WALLPAPER_GRID_DENSITY_OPTIONS } from "../../shared/constants/grid"
import type { WallpaperGridDensity } from "../../shared/constants/grid"
import type { AppSettings } from "../../shared/constants/app"
import { getFpsOptions, cn } from "@/lib/utils"
import { CompatibilityScanRow } from "@/components/settings/compatibility-scan-row"
import { LoadingButton } from "@/components/loading-button"
import { PageHeader } from "@/components/page-header"
import { useState } from "react"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const windowGeometrySchema = z.object({
    windowGeometry: z.string().trim().refine((value) => !value || /^[1-9]\d*x[1-9]\d*$/.test(value), "Use widthxheight, for example 800x600"),
})
const STARTUP_TRAY_CONTENT_ID = "startup-tray-options"
const WINDOW_GEOMETRY_CONTENT_ID = "window-geometry-options"
type WindowGeometryForm = z.infer<typeof windowGeometrySchema>

const DENSITY_ICONS: Record<WallpaperGridDensity, typeof Grid3x3> = {
    compact: Grid3x3,
    medium: Grid2x2,
    large: Square,
}

export const Route = createFileRoute("/settings")({
    component: SettingsPage,
})

function SettingsPage() {
    const { data: settings, isLoading, error } = trpc.settings.get.useQuery()
    const utils = trpc.useUtils()

    const updateMutation = trpc.settings.update.useMutation({
        onSuccess: () => {
            utils.settings.get.invalidate()
        },
    })

    const resetMutation = trpc.settings.reset.useMutation({
        onSuccess: () => {
            utils.settings.get.invalidate()
        },
    })

    const { mode, setMode } = useTheme()

    const { data: flatpakData } = trpc.settings.isFlatpak.useQuery()
    const isFlatpakEnv = flatpakData?.isFlatpak ?? false

    const [startupTrayOpen, setStartupTrayOpen] = useState(false)
    const [windowGeometryOpen, setWindowGeometryOpen] = useState(false)

    const windowGeometryForm = useForm<WindowGeometryForm>({
        resolver: zodResolver(windowGeometrySchema),
        values: {
            windowGeometry: settings?.windowGeometry ?? "",
        },
    })

    // Get max refresh rate from displays
    const { data: maxRefreshData } = trpc.display.maxRefreshRate.useQuery()

    // Update a single setting immediately
    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        updateMutation.mutate({ [key]: value })
    }

    const submitWindowGeometry = windowGeometryForm.handleSubmit(({ windowGeometry }) => {
        updateMutation.mutate(
            { windowGeometry: windowGeometry || null },
            {
                onError: (error) => {
                    windowGeometryForm.setError("windowGeometry", { message: error.message })
                },
            },
        )
    })

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="size-8 animate-spin mb-4" />
                <p>Loading settings...</p>
            </div>
        )
    }

    if (error || !settings) {
        return (
            <div className="p-6">
                <div className="text-destructive">
                    Failed to load settings
                    {error && <p className="text-sm mt-2">{error.message}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-h-[100vh]">
            <PageHeader
                title="Settings"
                description="Configure global application preferences"
                action={
                    <LoadingButton
                        variant="ghost"
                        size="sm"
                        onClick={() => resetMutation.mutate()}
                        isLoading={resetMutation.isPending}
                        loadingText="Resetting..."
                        className="ring-1 ring-foreground/20 hover:ring-foreground/40"
                    >
                        <RotateCcw className="size-4 mr-2" />
                        Reset to Defaults
                    </LoadingButton>
                }
            />

            <div className="columns-1 gap-6 2xl:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
                {/* General Section */}
                <SettingsSection
                    icon={Settings}
                    title="General"
                    description="App behavior and startup"
                >
                    <SettingRow label="Pause on fullscreen apps">
                        <Switch
                            aria-label="Pause on fullscreen apps"
                            checked={settings.pauseOnFullscreen}
                            onCheckedChange={(checked) => updateSetting("pauseOnFullscreen", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Launch on startup">
                        <Switch
                            aria-label="Launch on startup"
                            checked={settings.launchOnLogin}
                            onCheckedChange={(checked) => updateSetting("launchOnLogin", checked)}
                        />
                    </SettingRow>
                    <SettingRow label={<span className="inline-flex items-center gap-1">Enable system tray <Button type="button" variant="ghost" size="icon" aria-label="Toggle advanced tray options" aria-expanded={startupTrayOpen} aria-controls={STARTUP_TRAY_CONTENT_ID} onClick={() => setStartupTrayOpen((o) => !o)} className="size-6 text-muted-foreground hover:text-foreground" title="Advanced tray options"><ChevronDown className={`size-3.5 transition-transform ${startupTrayOpen ? "rotate-180" : ""}`} /></Button></span>} className={!startupTrayOpen ? "border-b-0" : ""}>
                        <Switch
                            aria-label="Enable system tray"
                            checked={settings.enableSystemTray}
                            onCheckedChange={(checked) => updateSetting("enableSystemTray", checked)}
                        />
                    </SettingRow>
                    <Collapsible open={startupTrayOpen} onOpenChange={setStartupTrayOpen}>
                        <CollapsibleContent id={STARTUP_TRAY_CONTENT_ID} forceMount hidden={!startupTrayOpen}>
                            <div className="divide-y divide-border bg-muted/30">
                                <SettingRow
                                    label="Minimize on startup"
                                    disabled={!settings.launchOnLogin || !settings.enableSystemTray}
                                >
                                    <Switch
                                        aria-label="Minimize on startup"
                                        checked={settings.minimizeOnStartup}
                                        onCheckedChange={(checked) => updateSetting("minimizeOnStartup", checked)}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label="Minimize on close"
                                    disabled={!settings.enableSystemTray}
                                    className="border-b-0"
                                >
                                    <Switch
                                        aria-label="Minimize on close"
                                        checked={settings.minimizeOnClose}
                                        onCheckedChange={(checked) => updateSetting("minimizeOnClose", checked)}
                                    />
                                </SettingRow>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </SettingsSection>

                {/* Compatibility Scan Section */}
                <SettingsSection
                    icon={ScanSearch}
                    title="Compatibility"
                    description="Test wallpapers for Linux compatibility"
                >
                    <CompatibilityScanRow settings={settings} updateSetting={updateSetting} />
                    <SettingRow label="Debug mode" >
                        <Switch
                            aria-label="Debug mode"
                            checked={settings.debugMode}
                            onCheckedChange={(v) => updateSetting("debugMode", v)}
                        />
                    </SettingRow>

                    <SettingRow 
                        label={(
                            <span className="inline-flex items-center gap-1">
                                Run in window mode
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Toggle window geometry options"
                                    aria-expanded={windowGeometryOpen}
                                    aria-controls={WINDOW_GEOMETRY_CONTENT_ID}
                                    onClick={() => setWindowGeometryOpen((o) => !o)}
                                    className="size-6 text-muted-foreground hover:text-foreground"
                                    title="Window geometry"
                                >
                                    <ChevronDown className={`size-3.5 transition-transform ${windowGeometryOpen ? "rotate-180" : ""}`} />
                                </Button>
                            </span>
                        )}
                        className={!windowGeometryOpen && !isFlatpakEnv ? "border-b-0" : ""}
                    >
                        <Switch
                            aria-label="Run in window mode"
                            checked={settings.windowMode}
                            onCheckedChange={(v) => updateSetting("windowMode", v)}
                        />
                    </SettingRow>

                    <Collapsible open={windowGeometryOpen} onOpenChange={setWindowGeometryOpen}>
                        <CollapsibleContent id={WINDOW_GEOMETRY_CONTENT_ID} forceMount hidden={!windowGeometryOpen}>
                            <div className="bg-muted/30">
                                    <SettingRow
                                        label={(
                                            <span>
                                                Window size <span className="text-muted-foreground">- optional backend window size</span>
                                            </span>
                                        )}
                                        disabled={!settings.windowMode}
                                        className={!isFlatpakEnv ? "border-b-0" : ""}
                                    >
                                        <form className="flex flex-col items-end gap-1" onSubmit={submitWindowGeometry}>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    {...windowGeometryForm.register("windowGeometry")}
                                                    placeholder="1920x1080"
                                                    disabled={!settings.windowMode}
                                                    aria-invalid={!!windowGeometryForm.formState.errors.windowGeometry}
                                                    aria-label="Window size"
                                                    className="w-28"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    type="submit"
                                                    disabled={!settings.windowMode || updateMutation.isPending}
                                                    aria-label="Save window size"
                                                    title="Save window size"
                                                    className="bg-transparent"
                                                >
                                                    <Check className="size-4" />
                                                </Button>
                                            </div>
                                            {windowGeometryForm.formState.errors.windowGeometry?.message && (
                                                <p className="max-w-56 text-right text-xs text-destructive">
                                                    {windowGeometryForm.formState.errors.windowGeometry.message}
                                                </p>
                                            )}
                                        </form>
                                    </SettingRow>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    {isFlatpakEnv && (
                        <SettingRow label="Bypass Flatpak sandbox" className="border-b-0">
                            <Switch
                                aria-label="Bypass Flatpak sandbox"
                                checked={settings.flatpakBypass}
                                onCheckedChange={(v) => updateSetting("flatpakBypass", v)}
                            />
                        </SettingRow>
                    )}
                </SettingsSection>

                {/* Audio Section */}
                <SettingsSection
                    icon={Volume2}
                    title="Audio"
                    description="Volume and audio processing"
                >
                    <SettingRow label="Volume">
                        <SliderControl
                            min={0}
                            max={100}
                            value={settings.volume}
                            onChange={(value) => updateSetting("volume", value)}
                            suffix="%"
                        />
                    </SettingRow>
                    <SettingRow label="Mute audio">
                        <Switch
                            aria-label="Mute audio"
                            checked={settings.silent}
                            onCheckedChange={(checked) => updateSetting("silent", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Don't mute when other apps play audio">
                        <Switch
                            aria-label="Don't mute when other apps play audio"
                            checked={settings.noAutomute}
                            onCheckedChange={(checked) => updateSetting("noAutomute", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Audio reactive effects" className="border-b-0">
                        <Switch
                            aria-label="Audio reactive effects"
                            checked={settings.audioProcessing}
                            onCheckedChange={(checked) => updateSetting("audioProcessing", checked)}
                        />
                    </SettingRow>
                </SettingsSection>

                {/* Display Section */}
                <SettingsSection
                    icon={Monitor}
                    title="Display"
                    description="Default display behavior"
                >
                    <SettingRow label="Maximum FPS">
                        <SelectControl
                            options={getFpsOptions(maxRefreshData?.maxRefreshRate ?? 60, settings.fps).map((fps) => ({
                                label: `${fps} FPS`,
                                value: String(fps),
                            }))}
                            value={String(settings.fps)}
                            onChange={(value) => updateSetting("fps", Number(value))}
                            triggerClassName="w-28"
                        />
                    </SettingRow>
                    <SettingRow label="Default scaling">
                        <SelectControl
                            options={SCALING_OPTIONS}
                            value={settings.defaultScaling}
                            onChange={(value) => updateSetting("defaultScaling", value as AppSettings["defaultScaling"])}
                            triggerClassName="w-28"
                        />
                    </SettingRow>
                    <SettingRow label="Disable mouse interaction">
                        <Switch
                            aria-label="Disable mouse interaction"
                            checked={settings.disableMouse}
                            onCheckedChange={(checked) => updateSetting("disableMouse", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Disable parallax effect">
                        <Switch
                            aria-label="Disable parallax effect"
                            checked={settings.disableParallax}
                            onCheckedChange={(checked) => updateSetting("disableParallax", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Disable particle effects" className="border-b-0">
                        <Switch
                            aria-label="Disable particle effects"
                            checked={settings.disableParticles}
                            onCheckedChange={(checked) => updateSetting("disableParticles", checked)}
                        />
                    </SettingRow>
                </SettingsSection>

                {/* Appearance Section */}
                <SettingsSection
                    icon={Palette}
                    title="Appearance"
                    description="Theme and visual preferences"
                >
                    <SettingRow label="Theme">
                        <SelectControl
                            options={THEME_OPTIONS}
                            value={mode}
                            onChange={(value) => {
                                const newTheme = value as AppSettings["theme"]
                                setMode(newTheme) // Apply theme immediately
                                updateSetting("theme", newTheme)
                            }}
                            triggerClassName="w-28"
                        />
                    </SettingRow>
                    <SettingRow label="Show compatibility dot">
                        <Switch
                            aria-label="Show compatibility dot"
                            checked={settings.showCompatibilityDot}
                            onCheckedChange={(checked) => updateSetting("showCompatibilityDot", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Grid size">
                        <div role="radiogroup" aria-label="Grid size" className="inline-flex items-center gap-0.5">
                            {WALLPAPER_GRID_DENSITY_OPTIONS.map(({ label, value }) => {
                                const Icon = DENSITY_ICONS[value]
                                const selected = settings.wallpaperGridDensity === value
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        title={label}
                                        onClick={() => updateSetting("wallpaperGridDensity", value)}
                                        className={cn(
                                            "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                            selected && "bg-accent text-accent-foreground",
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </button>
                                )
                            })}
                        </div>
                    </SettingRow>
                    <SettingRow label="Show status bar">
                        <Switch
                            aria-label="Show status bar"
                            checked={settings.showStatusBar}
                            onCheckedChange={(checked) => updateSetting("showStatusBar", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Dynamic background" className="border-b-0">
                        <Switch
                            aria-label="Dynamic background"
                            checked={settings.dynamicBackground}
                            onCheckedChange={(checked) => updateSetting("dynamicBackground", checked)}
                        />
                    </SettingRow>

                </SettingsSection>

            </div>
        </div>
    )
}
