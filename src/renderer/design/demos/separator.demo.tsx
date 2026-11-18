import { FadeDivider } from '@/components/ui/fade-divider'
import { Separator } from '@/components/ui/separator'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Separator', components: ['separator', 'fade-divider'] }

export default function SeparatorDemo() {
  return (
    <Rows>
      <Row label="separator" className="block">
        <Separator />
      </Row>
      <Row label="vertical">
        <div className="flex h-5 items-center gap-3 text-sm">
          Installed
          <Separator orientation="vertical" />
          Workshop
          <Separator orientation="vertical" />
          Playlists
        </div>
      </Row>
      <Row label="fade" className="block">
        <FadeDivider />
      </Row>
      <Row label="fade vertical">
        <div className="flex h-10 items-center gap-3 text-sm">
          Details
          <FadeDivider orientation="vertical" />
          Properties
        </div>
      </Row>
    </Rows>
  )
}
