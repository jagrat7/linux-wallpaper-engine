import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Field',
  components: ['field', 'input', 'textarea', 'label'],
}

export default function FieldDemo() {
  return (
    <Rows>
      <FieldSet>
        <FieldLegend>New playlist</FieldLegend>
        <FieldDescription>Wallpapers play in turn on the screens you pick.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="design-playlist-name">Name</FieldLabel>
            <Input id="design-playlist-name" placeholder="Evening rotation" />
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="design-playlist-interval">Interval</FieldLabel>
            <Input id="design-playlist-interval" aria-invalid defaultValue="0" />
            <FieldError>Interval must be at least 1 minute</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="design-playlist-notes">Notes</FieldLabel>
            <Textarea id="design-playlist-notes" placeholder="What this playlist is for" />
          </Field>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Shuffle</FieldTitle>
              <FieldDescription>Play the wallpapers in a random order</FieldDescription>
            </FieldContent>
            <Switch aria-label="Shuffle" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <Row label="label">
        <Label htmlFor="design-fps">FPS limit</Label>
        <Input id="design-fps" className="w-24" defaultValue="30" />
      </Row>
      <Row label="disabled">
        <Input disabled placeholder="Steam path" className="max-w-64" />
      </Row>
    </Rows>
  )
}
