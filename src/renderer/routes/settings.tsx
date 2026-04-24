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
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingRow } from "@/components/settings/setting-row"
import { trpc } from "@/lib/trpc"
import { useTheme } from "@/components/theme-provider"
import { THEME_OPTIONS } from "../../shared/constants/theme"
import { SCALING_OPTIONS } from "../../shared/constants/display"
import type { AppSettings } from "../../shared/constants/app"
import { getFpsOptions } from "@/lib/utils"
import { CompatibilityScanRow } from "@/components/settings/compatibility-scan-row"
import { LoadingButton } from "@/components/loading-button"
import { PageHeader } from "@/components/page-header"
import { lazy, Suspense, useState } from "react"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

// Dev-only flag to show onboarding test button
const DEV_SHOW_ONBOARDING_TEST = false

const DevOnboardingTest = lazy(() => import("@/components/settings/dev-onboarding-test").then(m => ({ default: m.DevOnboardingTest })))

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

    // Get max refresh rate from displays
    const { data: maxRefreshData } = trpc.display.maxRefreshRate.useQuery()

    // Update a single setting immediately
    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        updateMutation.mutate({ [key]: value })
    }

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
                id="onboarding-settings-page"
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

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                {/* General Section */}
                <SettingsSection
                    id="onboarding-performance"
                    icon={Settings}
                    title="General"
                    description="App behavior and startup"
                >
                    <SettingRow label="Pause on fullscreen apps">
                        <Switch
                            checked={settings.pauseOnFullscreen}
                            onCheckedChange={(checked) => updateSetting("pauseOnFullscreen", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Launch on startup">
                        <Switch
                            checked={settings.launchOnLogin}
                            onCheckedChange={(checked) => updateSetting("launchOnLogin", checked)}
                        />
                    </SettingRow>
                    <SettingRow label={<span className="inline-flex items-center gap-1">Enable system tray <Button variant="ghost" size="icon" onClick={() => setStartupTrayOpen((o) => !o)} className="size-6 text-muted-foreground hover:text-foreground" title="Advanced tray options"><ChevronDown className={`size-3.5 transition-transform ${startupTrayOpen ? "rotate-180" : ""}`} /></Button></span>} className={!startupTrayOpen ? "border-b-0" : ""}>
                        <Switch
                            checked={settings.enableSystemTray}
                            onCheckedChange={(checked) => updateSetting("enableSystemTray", checked)}
                        />
                    </SettingRow>
                    {startupTrayOpen && (
                    <Collapsible open={startupTrayOpen} onOpenChange={setStartupTrayOpen}>
                        <CollapsibleContent>
                            <div className="divide-y divide-border bg-muted/30">
                                <SettingRow
                                    label="Minimize on startup"
                                    disabled={!settings.launchOnLogin || !settings.enableSystemTray}
                                >
                                    <Switch
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
                                        checked={settings.minimizeOnClose}
                                        onCheckedChange={(checked) => updateSetting("minimizeOnClose", checked)}
                                    />
                                </SettingRow>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                    )}
                </SettingsSection>

                {/* Compatibility Scan Section */}
                <SettingsSection
                    icon={ScanSearch}
                    title="Compatibility"
                    description="Test wallpapers for Linux compatibility"
                    id="onboarding-compatibility-scan"
                >
                    <CompatibilityScanRow settings={settings} updateSetting={updateSetting} />
                    <SettingRow label="Debug mode" className={!isFlatpakEnv ? "border-b-0" : ""}>
                        <Switch
                            checked={settings.debugMode}
                            onCheckedChange={(v) => updateSetting("debugMode", v)}
                        />
                    </SettingRow>
                    {isFlatpakEnv && (
                        <SettingRow label="Bypass Flatpak sandbox" className="border-b-0">
                            <Switch
                                checked={settings.flatpakBypass}
                                onCheckedChange={(v) => updateSetting("flatpakBypass", v)}
                            />
                        </SettingRow>
                    )}
                </SettingsSection>

                {/* Audio Section */}
                <SettingsSection
                    id="onboarding-audio"
                    icon={Volume2}
                    title="Audio"
                    description="Volume and audio processing"
                >
                    <SettingRow label="Volume">
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.volume}
                                onChange={(e) => updateSetting("volume", Number(e.target.value))}
                                className="w-32 accent-primary"
                            />
                            <span className="text-sm text-muted-foreground w-10">
                                {settings.volume}%
                            </span>
                        </div>
                    </SettingRow>
                    <SettingRow label="Mute audio">
                        <Switch
                            checked={settings.silent}
                            onCheckedChange={(checked) => updateSetting("silent", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Don't mute when other apps play audio">
                        <Switch
                            checked={settings.noAutomute}
                            onCheckedChange={(checked) => updateSetting("noAutomute", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Audio reactive effects" className="border-b-0">
                        <Switch
                            checked={settings.audioProcessing}
                            onCheckedChange={(checked) => updateSetting("audioProcessing", checked)}
                        />
                    </SettingRow>
                </SettingsSection>

                {/* Display Section */}
                <SettingsSection
                    id="onboarding-display"
                    icon={Monitor}
                    title="Display"
                    description="Default display behavior"
                >
                    <SettingRow label="Maximum FPS">
                        <Select
                            value={String(settings.fps)}
                            onValueChange={(value) => updateSetting("fps", Number(value))}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {getFpsOptions(maxRefreshData?.maxRefreshRate ?? 60, settings.fps).map((fps) => (
                                    <SelectItem key={fps} value={String(fps)}>
                                        {fps} FPS
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingRow>
                    <SettingRow label="Default scaling">
                        <Select
                            value={settings.defaultScaling}
                            onValueChange={(value) => updateSetting("defaultScaling", value as AppSettings["defaultScaling"])}
                        >
                            <SelectTrigger className="w-28">
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
                    <SettingRow label="Disable mouse interaction">
                        <Switch
                            checked={settings.disableMouse}
                            onCheckedChange={(checked) => updateSetting("disableMouse", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Disable parallax effect" className="border-b-0">
                        <Switch
                            checked={settings.disableParallax}
                            onCheckedChange={(checked) => updateSetting("disableParallax", checked)}
                        />
                    </SettingRow>
                </SettingsSection>

                {/* Appearance Section */}
                <SettingsSection
                    id="onboarding-appearance"
                    icon={Palette}
                    title="Appearance"
                    description="Theme and visual preferences"
                    className="max-2xl:mb-4"
                >
                    <SettingRow label="Theme">
                        <Select
                            value={mode}
                            onValueChange={(value) => {
                                const newTheme = value as AppSettings["theme"]
                                setMode(newTheme) // Apply theme immediately
                                updateSetting("theme", newTheme)
                            }}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {THEME_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingRow>
                    <SettingRow label="Show compatibility dot">
                        <Switch
                            checked={settings.showCompatibilityDot}
                            onCheckedChange={(checked) => updateSetting("showCompatibilityDot", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Show status bar">
                        <Switch
                            checked={settings.showStatusBar}
                            onCheckedChange={(checked) => updateSetting("showStatusBar", checked)}
                        />
                    </SettingRow>
                    <SettingRow label="Dynamic background" className="border-b-0">
                        <Switch
                            checked={settings.dynamicBackground}
                            onCheckedChange={(checked) => updateSetting("dynamicBackground", checked)}
                        />
                    </SettingRow>

                </SettingsSection>

                {/* Dev-only: Test Onboarding */}
                {DEV_SHOW_ONBOARDING_TEST && (
                    <Suspense fallback={null}>
                        <DevOnboardingTest />
                    </Suspense>
                )}
            </div>
        </div>
    )
}


