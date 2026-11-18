import { Switch } from '@/components/ui/switch'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Switch', components: ['switch'] }

export default function SwitchDemo() {
  return (
    <Rows>
      <Row label="default">
        <Switch aria-label="Mute audio" />
        <Switch defaultChecked aria-label="Show status bar" />
      </Row>
      <Row label="sm">
        <Switch size="sm" aria-label="Mute audio" />
        <Switch size="sm" defaultChecked aria-label="Show status bar" />
      </Row>
      <Row label="disabled">
        <Switch disabled aria-label="Minimize on close" />
        <Switch disabled defaultChecked aria-label="Minimize on close" />
      </Row>
    </Rows>
  )
}
