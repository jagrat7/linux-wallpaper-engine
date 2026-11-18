import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Sheet', components: ['sheet'] }

const SIDES = ['right', 'left', 'top', 'bottom'] as const

export default function SheetDemo() {
  return (
    <Rows>
      <Row label="side">
        {SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="outline">{side}</Button>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Wallpaper details</SheetTitle>
                <SheetDescription>Aurora Borealis · Scene · 48 MB</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <SheetClose asChild>
                  <Button>Done</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </Row>
    </Rows>
  )
}
