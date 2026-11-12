import { ChevronRight } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Collapsible', components: ['collapsible'] }

export default function CollapsibleDemo() {
  return (
    <Rows>
      <Collapsible defaultOpen className="grid max-w-80 gap-2 text-sm">
        <CollapsibleTrigger className="group flex items-center gap-1 font-medium">
          <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
          Advanced
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground pl-5">
          Extra flags passed to linux-wallpaperengine on every launch.
        </CollapsibleContent>
      </Collapsible>
    </Rows>
  )
}
