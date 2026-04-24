import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface UnsubscribeButtonProps {
    onClick: () => void
    disabled?: boolean
}

export function UnsubscribeButton({ onClick, disabled = false }: UnsubscribeButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={onClick}
                    disabled={disabled}
                >
                    <Trash2 className="size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Unsubscribe</TooltipContent>
        </Tooltip>
    )
}
