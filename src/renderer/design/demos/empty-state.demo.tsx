import { ImageOff, ListVideo } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Empty state',
  components: [],
  custom: { file: 'src/renderer/components/empty-state.tsx', exports: 'EmptyState' },
}

export default function EmptyStateDemo() {
  return (
    <Rows>
      <EmptyState
        className="py-6"
        icon={ImageOff}
        title="No wallpapers found"
        description="Subscribe to wallpapers on the Workshop, then refresh."
      />
      <EmptyState className="py-6" icon={ListVideo} title="No playlists yet" />
    </Rows>
  )
}
