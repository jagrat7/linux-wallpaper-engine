import { Grid2x2, Heart, List, Volume2 } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Icon button', components: ['icon-button'] }

export default function IconButtonDemo() {
  return (
    <Rows>
      <Row label="size">
        <IconButton icon={Grid2x2} size="sm" aria-label="Grid" />
        <IconButton icon={Grid2x2} aria-label="Grid" />
      </Row>
      <Row label="pressed">
        <IconButton icon={Grid2x2} pressed aria-label="Grid" />
        <IconButton icon={List} aria-label="List" />
        <IconButton icon={Heart} pressed aria-label="Favourite" />
      </Row>
      <Row label="disabled">
        <IconButton icon={Volume2} disabled aria-label="Mute" />
      </Row>
    </Rows>
  )
}
