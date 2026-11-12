import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Dialog', components: ['dialog'] }

export default function DialogDemo() {
  return (
    <Rows>
      <Row label="click">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Debug log</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Debug log</DialogTitle>
              <DialogDescription>Output from the last launch of the backend.</DialogDescription>
            </DialogHeader>
            <pre className="bg-muted text-muted-foreground rounded-md p-3 font-mono text-xs">
              linux-wallpaperengine --screen-root DP-1 --fps 30
            </pre>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button>Copy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>
    </Rows>
  )
}
