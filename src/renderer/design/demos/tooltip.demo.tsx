import { Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Tooltip', components: ['tooltip'] }

export default function TooltipDemo() {
  return (
    <Rows>
      <Row label="hover">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Random wallpaper">
              <Shuffle />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Random wallpaper</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Compatibility</Button>
          </TooltipTrigger>
          <TooltipContent side="right">Scanned 2 days ago</TooltipContent>
        </Tooltip>
      </Row>
    </Rows>
  )
}
