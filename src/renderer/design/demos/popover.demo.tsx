import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Popover', components: ['popover'] }

export default function PopoverDemo() {
  return (
    <Rows>
      <Row label="click">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Screens</Button>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Apply to</PopoverTitle>
              <PopoverDescription>DP-1 and HDMI-A-1 are connected.</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </Row>
    </Rows>
  )
}
