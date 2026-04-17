import { RefreshCw, Unplug } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { trpc } from "@/lib/trpc"

export function WorkshopConnectionButton() {
  const utils = trpc.useUtils()
  const { data: status } = trpc.workshop.connectionStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  const invalidateWorkshopQueries = () => {
    void utils.workshop.connectionStatus.invalidate()
    void utils.workshop.getItems.invalidate()
    void utils.workshop.discover.invalidate()
  }

  const disconnectMutation = trpc.workshop.disconnect.useMutation({
    onSuccess: invalidateWorkshopQueries,
  })

  const reconnectMutation = trpc.workshop.reconnect.useMutation({
    onSuccess: invalidateWorkshopQueries,
  })

  const isConnected = status === "connected"

  if (isConnected) {
    return (
      <LoadingButton
        variant="ghost"
        size="sm"
        onClick={() => disconnectMutation.mutate()}
        isLoading={disconnectMutation.isPending}
        loadingText="Disconnecting..."
        className="ring-1 ring-foreground/20 hover:ring-foreground/40"
      >
        <Unplug className="size-4 mr-2" />
        Drop Connection
      </LoadingButton>
    )
  }

  return (
    <LoadingButton
      variant="ghost"
      size="sm"
      onClick={() => reconnectMutation.mutate()}
      isLoading={reconnectMutation.isPending}
      loadingText="Reconnecting..."
      className="ring-1 ring-foreground/20 hover:ring-foreground/40"
    >
      <RefreshCw className="size-4 mr-2" />
      Refresh
    </LoadingButton>
  )
}
