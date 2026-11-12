import { useState } from 'react'

import { Sortable, SortableHandle, SortableItem } from '@/components/ui/sortable'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Sortable', components: ['sortable'] }

export default function SortableDemo() {
  const [rows, setRows] = useState(['Aurora Borealis', 'Rainy Tokyo', 'Clock Tower', 'Deep Space'])
  const [chips, setChips] = useState(['DP-1', 'HDMI-A-1', 'eDP-1'])
  return (
    <Rows>
      <Row label="vertical" className="block">
        <Sortable value={rows} onValueChange={setRows} className="max-w-64 gap-1">
          {rows.map((row) => (
            <SortableItem
              key={row}
              value={row}
              className="bg-card flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5 text-xs"
            >
              {row}
              <SortableHandle className="ml-auto" aria-label={`Move ${row}`} />
            </SortableItem>
          ))}
        </Sortable>
      </Row>
      <Row label="horizontal" className="block">
        <Sortable
          orientation="horizontal"
          value={chips}
          onValueChange={setChips}
          className="w-fit gap-2"
        >
          {chips.map((chip) => (
            <SortableItem key={chip} value={chip}>
              {/* The whole chip is the handle. */}
              <SortableHandle
                className="bg-card text-foreground size-auto rounded-md border px-3 py-1 text-xs"
                aria-label={`Move ${chip}`}
              >
                {chip}
              </SortableHandle>
            </SortableItem>
          ))}
        </Sortable>
      </Row>
    </Rows>
  )
}
