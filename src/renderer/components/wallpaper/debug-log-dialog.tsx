import { useEffect, useRef } from 'react'
import { Copy, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { trpc } from '@/lib/trpc'

interface DebugLogDialogProps {
  open: boolean
  onClose: () => void
  screen: string
}

export function DebugLogDialog({ open, onClose, screen }: DebugLogDialogProps) {
  const logEndRef = useRef<HTMLDivElement>(null)

  const { data } = trpc.wallpaper.getDebugLogs.useQuery(
    { screen },
    {
      enabled: open && !!screen,
      refetchInterval: open ? 500 : false,
    },
  )

  const clearMutation = trpc.wallpaper.clearDebugLogs.useMutation()

  const logs = data?.logs ?? []
  const command = data?.command ?? ''

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length])

  const handleClose = () => {
    clearMutation.mutate({ screen })
    onClose()
  }

  const handleCopyLogs = () => {
    const text = [`$ ${command}`, '', ...logs].join('\n')
    navigator.clipboard.writeText(text)
  }

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(command)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="scrollbar-styled flex max-h-[80vh] w-[90vw] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            Debug Logs — {screen}
          </DialogTitle>
          <DialogDescription>Real-time process output from linux-wallpaperengine</DialogDescription>
        </DialogHeader>

        {command && (
          <div className="bg-muted/50 border-border flex items-center gap-2 rounded-md border px-3 py-2">
            <pre className="text-muted-foreground flex-1 font-mono text-xs break-all whitespace-pre-wrap">
              $ {command}
            </pre>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopyCommand}
              title="Copy command"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="bg-muted/50 border-border text-foreground scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {logs.length === 0 ? (
            <p className="text-muted-foreground italic">Waiting for output...</p>
          ) : (
            logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('[stderr]')
                    ? 'text-warning'
                    : line.startsWith('[process]')
                      ? 'text-destructive'
                      : ''
                }
              >
                {line}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleCopyLogs}>
            <Copy className="mr-2 size-4" />
            Copy Logs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
