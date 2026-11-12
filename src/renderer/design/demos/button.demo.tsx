import { ArrowRight, Download, Play, Shuffle, Square, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Button', components: ['button'] }

export default function ButtonDemo() {
  return (
    <Rows>
      <Row label="variant">
        <Button>Apply</Button>
        <Button variant="outline">Refresh</Button>
        <Button variant="secondary">Edit</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Unsubscribe</Button>
        <Button variant="link">Open in Steam</Button>
      </Row>
      <Row label="size">
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button>default</Button>
        <Button size="lg">lg</Button>
      </Row>
      <Row label="icon">
        <Button>
          <Play />
          Apply
        </Button>
        <Button variant="outline">
          Browse Workshop
          <ArrowRight />
        </Button>
        <Button size="icon-xs" variant="outline" aria-label="Random">
          <Shuffle />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Download">
          <Download />
        </Button>
        <Button size="icon" variant="outline" aria-label="Stop">
          <Square />
        </Button>
        <Button size="icon-lg" variant="destructive" aria-label="Delete playlist">
          <Trash2 />
        </Button>
      </Row>
      <Row label="disabled">
        <Button disabled>Apply</Button>
        <Button variant="outline" disabled>
          Refresh
        </Button>
      </Row>
    </Rows>
  )
}
