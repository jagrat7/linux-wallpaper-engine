import { AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc"
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE } from "../../../shared/constants/wallpaper"

interface BackendNotInstalledDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function BackendNotInstalledDialog({ open, onOpenChange }: BackendNotInstalledDialogProps) {
    const openExternalMutation = trpc.window.openExternal.useMutation()

    const handleOpenInstallGuide = async () => {
        await openExternalMutation.mutateAsync({ url: "https://github.com/jagrat7/linux-wallpaper-engine/blob/main/docs/README.md#2-install-linux-wallpaperengine" })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md border-border">
                <DialogHeader className="gap-3 pr-6">
                    <div className="flex size-10 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                        <AlertTriangle className="size-5" />
                    </div>
                    <div className="grid gap-2">
                        <DialogTitle>linux-wallpaperengine is missing</DialogTitle>
                        <DialogDescription className="leading-6">
                            {BACKEND_NOT_INSTALLED_ERROR_MESSAGE}. Install it, and/or copy the binary to your PATH (e.g., ~/bin), then try applying the wallpaper again.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Dismiss
                    </Button>
                    <Button onClick={handleOpenInstallGuide}>
                        <ExternalLink className="size-4" />
                        Docs
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
