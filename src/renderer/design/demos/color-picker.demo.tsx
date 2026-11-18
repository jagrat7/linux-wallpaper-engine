import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '@/components/ui/kibo-ui/color-picker'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Color picker', components: ['kibo-ui/color-picker/index'] }

export default function ColorPickerDemo() {
  return (
    <Rows>
      <Row label="default" className="block">
        {/* As color-control.tsx lays it out: the selection square above the hue slider */}
        <ColorPicker defaultValue="#3b82f6" className="w-56 gap-3">
          <ColorPickerSelection className="h-36" />
          <ColorPickerHue />
        </ColorPicker>
      </Row>
    </Rows>
  )
}
