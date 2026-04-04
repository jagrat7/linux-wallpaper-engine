import { createFileRoute } from "@tanstack/react-router"
import { Monitor, Plus, Loader2, AlertCircle, AlertTriangle, Info, Pencil, RotateCcw } from "lucide-react"
import { WallpaperThumbnail } from "@/components/wallpaper/wallpaper-thumbnail"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { useMemo, useState } from "react"

export const Route = createFileRoute("/displays")({
    component: DisplaysPage,
})

interface DisplayMonitor {
    id: string
    name: string
    resolution: string
    position: { x: number; y: number }
    wallpaper: { name: string; thumbnail: string } | null
    scaling: "fill" | "stretch" | "fit" | "default"
    degraded: boolean
}

function DisplaysPage() {
    const { data: displays, isLoading, error } = trpc.display.list.useQuery()
    const { data: session } = trpc.display.session.useQuery()
    const { data: activeWallpapers = [] } = trpc.wallpaper.getActiveWallpaper.useQuery(undefined, {
        refetchInterval: 5000,
    })

    const utils = trpc.useUtils()
    const renameMutation = trpc.display.rename.useMutation({
        onSuccess: () => utils.display.list.invalidate(),
    })
    const resetNameMutation = trpc.display.resetName.useMutation({
        onSuccess: () => utils.display.list.invalidate(),
    })

    const monitors: DisplayMonitor[] = useMemo(() => {
        if (!displays) return []
        return displays.map((d) => {
            const active = activeWallpapers.find(w => w.screen === d.name)
            return {
                id: d.id,
                name: d.name,
                resolution: d.resolution,
                position: { x: d.x, y: d.y },
                wallpaper: active ? {
                    name: active.title ?? 'Unknown',
                    thumbnail: active.thumbnail ? `local-file://${active.thumbnail}` : '',
                } : null,
                scaling: (active?.wallpaper.scaling ?? "default") as DisplayMonitor["scaling"],
                degraded: d.degraded,
            }
        })
    }, [displays, activeWallpapers])

    const hasDegraded = monitors.some(m => m.degraded)

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground glass">
                <Loader2 className="size-8 animate-spin mb-4" />
                <p>Detecting displays...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-destructive glass">
                <AlertCircle className="size-8 mb-4" />
                <p className="font-medium">Failed to detect displays</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </div>
        )
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Displays"
                description="View wallpapers for each monitor"
                action={
                    session ? (
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                            {session.type.toUpperCase()}
                        </span>
                    ) : undefined
                }
            />

            {hasDegraded && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <AlertTriangle className="size-5 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-yellow-500">Limited display detection</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Display names were detected using a fallback method that may not match your compositor's output names.
                            If wallpapers fail to apply, edit the display name below to match the output name shown in your compositor settings
                            (e.g. <code className="text-yellow-500/80">eDP-1</code>, <code className="text-yellow-500/80">HDMI-A-1</code>).
                        </p>
                    </div>
                </div>
            )}

            <div id="onboarding-display-layout" className="mb-8 min-h-[200px] md:min-h-[300px] lg:min-h-[400px] xl:min-h-[450px] rounded-xl border border-border bg-card p-6 glass">
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                    Monitor Layout
                </h2>
                <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 py-8 md:py-12 lg:py-16">
                    {monitors.length === 0 ? (
                        <div className="text-center text-muted-foreground">
                            <Monitor className="size-12 mx-auto mb-2 opacity-50" />
                            <p>No displays detected</p>
                        </div>
                    ) : (
                        monitors.map((monitor) => (
                            <div
                                key={monitor.id}
                                className="group relative aspect-video overflow-hidden rounded-lg border-2 border-border bg-secondary/50 transition-all hover:border-ring
                                    w-36 sm:w-44 md:w-56 lg:w-72 xl:w-80"
                            >
                                {monitor.wallpaper ? (
                                    <WallpaperThumbnail
                                        src={monitor.wallpaper.thumbnail}
                                        alt={monitor.wallpaper.name}
                                        containerClassName="aspect-auto size-full"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">
                                        <Plus className="size-8 text-muted-foreground/50" />
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                    <p className="text-xs font-medium text-white">{monitor.name}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div id="onboarding-display-settings" className="space-y-4">
                <h2 className="text-lg font-semibold">Display Settings</h2>
                {monitors.map((monitor) => (
                    <DisplaySettingsRow
                        key={monitor.id}
                        monitor={monitor}
                        onRename={(name) => renameMutation.mutate({ displayId: monitor.id, name })}
                        onResetName={() => resetNameMutation.mutate({ displayId: monitor.id })}
                        isRenamed={monitor.id !== monitor.name}
                    />
                ))}
            </div>
        </div>
    )
}

function DisplaySettingsRow({
    monitor,
    onRename,
    onResetName,
    isRenamed,
}: {
    monitor: DisplayMonitor
    onRename: (name: string) => void
    onResetName: () => void
    isRenamed: boolean
}) {
    const [open, setOpen] = useState(false)
    const [editValue, setEditValue] = useState(monitor.name)

    const handleSave = () => {
        const trimmed = editValue.trim()
        if (trimmed && trimmed !== monitor.name) {
            onRename(trimmed)
        }
        setOpen(false)
    }

    return (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 glass">
            <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                    <Monitor className="size-5 text-muted-foreground" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium">{monitor.name}</h3>
                        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setEditValue(monitor.name) }}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-6">
                                    <Pencil className="size-3" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Rename Display</DialogTitle>
                                    <DialogDescription>
                                        Set the output name used by your compositor (e.g. eDP-1, HDMI-A-1, DP-2).
                                        This name is passed to linux-wallpaperengine via --screen-root.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="display-name">Display name</Label>
                                        <InputGroup>
                                            <InputGroupAddon align="inline-start">
                                                <Monitor className="size-4" />
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                id="display-name"
                                                value={editValue}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                                                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSave() }}
                                                placeholder={monitor.id}
                                            />
                                        </InputGroup>
                                    </div>
                                    {monitor.id !== editValue.trim() && editValue.trim() && (
                                        <p className="text-xs text-muted-foreground">
                                            Detected as <code className="bg-secondary px-1 rounded">{monitor.id}</code>, will be renamed to <code className="bg-secondary px-1 rounded">{editValue.trim()}</code>
                                        </p>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={!editValue.trim()}>
                                        Save
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {isRenamed && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-6"
                                            onClick={onResetName}
                                        >
                                            <RotateCcw className="size-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-sm">Reset to detected name ({monitor.id})</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {isRenamed ? `${monitor.id} - ` : ''}{monitor.resolution}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-sm font-medium">
                        {monitor.wallpaper?.name ?? "No wallpaper"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Scaling: {monitor.scaling}
                    </p>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex size-8 cursor-help items-center justify-center rounded-md text-muted-foreground ">
                                <Info className="size-4" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                            <p className="text-sm">
                                Select a wallpaper from the gallery to apply it here. Use per-wallpaper settings to customize settings for each wallpaper.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    )
}
