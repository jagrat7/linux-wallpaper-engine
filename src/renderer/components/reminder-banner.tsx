import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type AlertVariant = "warning" | "info"

interface ReminderBannerProps {
  variant: AlertVariant
  icon: React.ReactNode
  children: React.ReactNode
  onDismiss: () => void
  className?: string
}

const linkClass: Record<AlertVariant, string> = {
  warning: "hover:text-warning/60",
  info: "hover:text-primary/60",
}

export { linkClass as reminderBannerLinkClass }

export function ReminderBanner({ variant, icon, children, onDismiss, className }: ReminderBannerProps) {
  return (
    <Alert variant={variant} className={cn("flex items-center justify-between gap-3 py-2.5", className)}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 [&>svg]:size-4">{icon}</span>
        <p className="text-sm opacity-80">{children}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="shrink-0 opacity-70 hover:opacity-100 hover:bg-current/10"
      >
        <X className="size-4" />
      </Button>
    </Alert>
  )
}
