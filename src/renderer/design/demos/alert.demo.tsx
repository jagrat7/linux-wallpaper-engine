import { AlertTriangle, Info, OctagonAlert, Sparkles } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Alert', components: ['alert'] }

export default function AlertDemo() {
  return (
    <Rows>
      <Alert>
        <Sparkles />
        <AlertTitle>Update available</AlertTitle>
        <AlertDescription>Version 0.4.12 is ready to install.</AlertDescription>
      </Alert>
      <Alert variant="info">
        <Info />
        <AlertTitle>Scan your library</AlertTitle>
        <AlertDescription>Find out which wallpapers run on this machine.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Backend not installed</AlertTitle>
        <AlertDescription>
          Install linux-wallpaperengine to apply scene wallpapers.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <OctagonAlert />
        <AlertTitle>Wallpaper failed to start</AlertTitle>
        <AlertDescription>The backend exited with code 1. Open the debug log.</AlertDescription>
      </Alert>
    </Rows>
  )
}
