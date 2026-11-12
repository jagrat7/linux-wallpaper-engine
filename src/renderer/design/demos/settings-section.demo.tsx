import { Palette } from 'lucide-react'

import { SettingsSection } from '@/components/settings/settings-section'
import { Switch } from '@/components/ui/switch'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Settings section',
  components: ['switch'],
  custom: {
    file: 'src/renderer/components/settings/settings-section.tsx',
    exports: 'SettingsSection',
  },
}

const ROWS = [
  { label: 'Dynamic background', description: 'Show the active wallpaper behind the app' },
  { label: 'Show status bar', description: 'What each screen is playing, along the bottom' },
]

export default function SettingsSectionDemo() {
  return (
    <Rows>
      <SettingsSection icon={Palette} title="Appearance" description="How the app looks">
        {ROWS.map((row, i) => (
          <div key={row.label} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-muted-foreground text-sm">{row.description}</p>
            </div>
            <Switch defaultChecked={i === 0} aria-label={row.label} />
          </div>
        ))}
      </SettingsSection>
    </Rows>
  )
}
