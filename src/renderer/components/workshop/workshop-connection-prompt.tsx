import { AlertCircle } from "lucide-react"

interface WorkshopConnectionPromptProps {
  message: string
}

export function WorkshopConnectionPrompt({ message }: WorkshopConnectionPromptProps) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
      <AlertCircle className="mb-4 size-10 text-warning" />
      <h2 className="text-lg font-semibold">Steam required</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
