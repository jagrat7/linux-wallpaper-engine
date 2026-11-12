import { RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Page header',
  components: ['button'],
  custom: { file: 'src/renderer/components/page-header.tsx', exports: 'PageHeader' },
}

export default function PageHeaderDemo() {
  return (
    <Rows>
      <PageHeader
        className="mb-0"
        title="Installed"
        description="Browse, manage, and apply your wallpapers."
        action={
          <Button variant="outline">
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <PageHeader
        className="mb-0"
        title="Displays"
        description="Pick a wallpaper for each screen."
      />
    </Rows>
  )
}
