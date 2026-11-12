import { LoadingButton } from '@/components/loading-button'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Loading button',
  components: ['button'],
  custom: { file: 'src/renderer/components/loading-button.tsx', exports: 'LoadingButton' },
}

export default function LoadingButtonDemo() {
  return (
    <Rows>
      <Row label="idle">
        <LoadingButton type="button" isLoading={false}>
          Scan library
        </LoadingButton>
        <LoadingButton type="button" variant="outline" isLoading={false}>
          Scan library
        </LoadingButton>
      </Row>
      <Row label="loading">
        <LoadingButton type="button" isLoading loadingText="Scanning...">
          Scan library
        </LoadingButton>
        <LoadingButton type="button" variant="default" isLoading loadingText="Saving...">
          Save
        </LoadingButton>
      </Row>
      <Row label="disabled">
        <LoadingButton type="button" isLoading={false} isDisabled>
          Scan library
        </LoadingButton>
      </Row>
    </Rows>
  )
}
