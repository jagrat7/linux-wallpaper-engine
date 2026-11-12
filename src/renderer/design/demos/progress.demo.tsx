import { Progress } from '@/components/ui/progress'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Progress', components: ['progress'] }

export default function ProgressDemo() {
  return (
    <Rows>
      <Row label="0%" className="block">
        <Progress value={0} aria-label="Download progress" />
      </Row>
      <Row label="40%" className="block">
        <Progress value={40} aria-label="Download progress" />
      </Row>
      <Row label="100%" className="block">
        <Progress value={100} aria-label="Download progress" />
      </Row>
    </Rows>
  )
}
