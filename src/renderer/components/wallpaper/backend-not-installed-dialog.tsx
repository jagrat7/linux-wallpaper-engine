import { AlertTriangle, ExternalLink, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { BACKEND_NOT_INSTALLED_ERROR_MESSAGE } from "../../../shared/constants/wallpaper"

interface BackendNotInstalledDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function BackendNotInstalledDialog({ open, onOpenChange }: BackendNotInstalledDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl border-border/70 bg-background/90 shadow-2xl backdrop-blur-xl">
                <DialogHeader className="gap-3 pr-8">
                    <div className="flex size-10 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                        <AlertTriangle className="size-5" />
                    </div>
                    <div className="grid gap-2">
                        <DialogTitle>linux-wallpaperengine is missing</DialogTitle>
                        <DialogDescription className="leading-6">
                            {BACKEND_NOT_INSTALLED_ERROR_MESSAGE}. Install it first, then make sure the binary can be found from your terminal.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="grid gap-3 rounded-md border border-border/70 bg-muted/35 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Terminal className="size-4" />
                        <span>After building from source, expose the binary</span>
                    </div>
                    <code className="overflow-x-auto rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                        sudo ln -sf /path/to/your/build/linux-wallpaperengine /usr/local/bin/linux-wallpaperengine
                    </code>
                </div>

                <DialogFooter>
                    <Button variant="outline" asChild>
                        <a href="https://github.com/Almamu/linux-wallpaperengine" target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" />
                            Build instructions
                        </a>
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
