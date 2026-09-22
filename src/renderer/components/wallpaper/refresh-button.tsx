import { RefreshCw } from 'lucide-react'
import { LoadingButton } from '@/components/loading-button'

interface RefreshButtonProps {
  onClick: () => void
  isLoading?: boolean
}

export function RefreshButton({ onClick, isLoading = false }: RefreshButtonProps) {
  return (
    <LoadingButton
      variant="ghost"
      size="sm"
      onClick={onClick}
      isLoading={isLoading}
      loadingText="Refreshing..."
      className="ring-foreground/20 hover:ring-foreground/40 ring-1"
    >
      <RefreshCw className="mr-2 size-4" />
      Refresh
    </LoadingButton>
  )
}
