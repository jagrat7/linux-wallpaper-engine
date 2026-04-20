import { EmptyState } from "@/components/empty-state"
import { SteamIcon } from "@/components/icons/steam"

interface WorkshopConnectionPromptProps {
  message: string
  title?: string
}

export function WorkshopConnectionPrompt({ message, title = "Steam client not found" }: WorkshopConnectionPromptProps) {
  return <EmptyState icon={SteamIcon} title={title} description={message} />
}
