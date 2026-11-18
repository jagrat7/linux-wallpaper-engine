import { Download, ScanSearch } from 'lucide-react'

import { ReminderBanner } from '@/components/reminder-banner'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Reminder banner',
  components: ['alert', 'button'],
  custom: { file: 'src/renderer/components/reminder-banner.tsx', exports: 'ReminderBanner' },
}

const dismiss = () => {}

export default function ReminderBannerDemo() {
  return (
    <Rows>
      <ReminderBanner variant="info" icon={<ScanSearch />} onDismiss={dismiss}>
        Scan your library to see which wallpapers work on this machine.
      </ReminderBanner>
      <ReminderBanner variant="warning" icon={<Download />} onDismiss={dismiss}>
        Version 0.4.12 is available.
      </ReminderBanner>
    </Rows>
  )
}
