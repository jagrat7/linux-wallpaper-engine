import { motion } from "framer-motion"
import { AlertCircle, X } from "lucide-react"
import { useEffect } from "react"
import { cn } from "~/lib/utils"

interface ErrorMessageProps {
  message: string | null
  setMessage: (message: string | null) => void // Make this required
  className?: string
  /**
   * Auto-dismiss duration in milliseconds. Set to 0 to disable auto-dismiss.
   * Default is 8000ms (8 seconds)
   */
  autoDismissTimeout?: number
}

export const ErrorMessage = ({
  message,
  setMessage,
  className = "",
  autoDismissTimeout = 8000,
}: ErrorMessageProps) => {
  // Set up auto-dismiss if a timeout is provided
  useEffect(() => {
    if (message && autoDismissTimeout > 0) {
      const timer = setTimeout(() => {
        setMessage(null)
      }, autoDismissTimeout)

      return () => clearTimeout(timer)
    }
  }, [message, setMessage, autoDismissTimeout])

  if (!message) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "group relative mb-2 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={() => setMessage(null)}
        className="rounded-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close error message"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
