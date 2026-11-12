import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Select', components: ['select'] }

export default function SelectDemo() {
  return (
    <Rows>
      <Row label="default">
        <Select defaultValue="fill">
          <SelectTrigger aria-label="Scaling">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Scaling</SelectLabel>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="fill">Fill</SelectItem>
              <SelectItem value="fit">Fit</SelectItem>
              <SelectSeparator />
              <SelectItem value="stretch">Stretch</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Row>
      <Row label="sm">
        <Select>
          <SelectTrigger size="sm" aria-label="Theme">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="steam">Steam</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="disabled">
        <Select disabled>
          <SelectTrigger aria-label="Screen">
            <SelectValue placeholder="DP-1" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DP-1">DP-1</SelectItem>
          </SelectContent>
        </Select>
      </Row>
    </Rows>
  )
}
