import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Table', components: ['table'] }

const ROWS = [
  { name: 'Aurora Borealis', type: 'Scene', result: 'Perfect' },
  { name: 'Rainy Tokyo', type: 'Video', result: 'Perfect' },
  { name: 'Clock Tower', type: 'Web', result: 'Minor issues' },
]

export default function TableDemo() {
  return (
    <Rows>
      <Table>
        <TableCaption>Compatibility scan</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Wallpaper</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.type}</TableCell>
              <TableCell className="text-right">{row.result}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Scanned</TableCell>
            <TableCell className="text-right">3 of 3</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Rows>
  )
}
