import { Skeleton } from '@/components/ui/skeleton'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Skeleton', components: ['skeleton'] }

export default function SkeletonDemo() {
  return (
    <Rows>
      <Row label="card">
        <div className="grid w-40 gap-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </Row>
      <Row label="line">
        <Skeleton className="h-4 w-56" />
      </Row>
    </Rows>
  )
}
