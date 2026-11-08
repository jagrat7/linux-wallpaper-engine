import type { ReactNode } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { ReminderBanner, reminderBannerLinkClass } from '@/components/reminder-banner'

const linkClass = `font-medium underline underline-offset-2 transition-colors ${reminderBannerLinkClass.info}`

export function UpdateReminderBanner() {
  const { data: settings } = trpc.settings.get.useQuery()
  const { data: update } = trpc.app.checkUpdate.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
  // Only the AppImage downloads its own update; main pushes progress via `app.updateStatus`
  const { data: download } = trpc.app.updateStatus.useQuery(undefined, {
    enabled: Boolean(update?.canAutoUpdate),
  })
  const utils = trpc.useUtils()
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.get.invalidate(),
  })
  const openExternal = trpc.window.openExternal.useMutation()
  const downloadUpdate = trpc.app.downloadUpdate.useMutation()
  const installUpdate = trpc.app.installUpdate.useMutation()

  if (!settings || !update?.hasUpdate || !update.latestVersion) return null
  // Closing the banner hides it for this version, whatever the download is doing
  if (settings.dismissedUpdateVersion === update.latestVersion) return null
  const downloadState = download?.state ?? 'idle'

  const viewRelease = (
    <button
      onClick={() => update.releaseUrl && openExternal.mutate({ url: update.releaseUrl })}
      className={linkClass}
    >
      View release
    </button>
  )

  let message: ReactNode
  if (!update.canAutoUpdate) {
    message = (
      <>
        <span className="font-medium">Update available:</span> v{update.latestVersion} is out.{' '}
        {viewRelease}
      </>
    )
  } else if (downloadState === 'downloading') {
    message = <span className="font-medium">Downloading v{update.latestVersion}…</span>
  } else if (downloadState === 'ready') {
    message = (
      <>
        <span className="font-medium">v{update.latestVersion} is ready.</span>{' '}
        <button onClick={() => installUpdate.mutate()} className={linkClass}>
          Restart to update
        </button>
      </>
    )
  } else {
    message = (
      <>
        <span className="font-medium">
          {downloadState === 'failed' ? 'Update download failed.' : 'Update available:'}
        </span>{' '}
        {downloadState === 'failed' ? '' : `v${update.latestVersion} is out. `}
        <button onClick={() => downloadUpdate.mutate()} className={linkClass}>
          {downloadState === 'failed' ? 'Try again' : 'Update now'}
        </button>{' '}
        · {viewRelease}
      </>
    )
  }

  return (
    <ReminderBanner
      variant="info"
      icon={<ArrowUpCircle />}
      onDismiss={() => updateSettings.mutate({ dismissedUpdateVersion: update.latestVersion })}
    >
      {message}
    </ReminderBanner>
  )
}
