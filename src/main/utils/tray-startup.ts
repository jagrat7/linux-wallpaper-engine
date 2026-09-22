import { hostExecAsync } from './host'

const STATUS_NOTIFIER_WATCHER = 'org.kde.StatusNotifierWatcher'
const STATUS_NOTIFIER_WATCHER_COMMAND = [
  'gdbus call --session',
  '--dest org.freedesktop.DBus',
  '--object-path /org/freedesktop/DBus',
  '--method org.freedesktop.DBus.NameHasOwner',
  STATUS_NOTIFIER_WATCHER,
].join(' ')
const TRAY_STARTUP_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const

export interface TrayStartupRetry {
  start: () => void
  stop: () => void
}

interface TrayStartupRetryOptions {
  createTray: () => void
  hasTray: () => boolean
  shouldStop: () => boolean
}

const isStatusNotifierWatcherMissing = async (): Promise<boolean> => {
  try {
    const { stdout } = await hostExecAsync(STATUS_NOTIFIER_WATCHER_COMMAND)
    return stdout.includes('false')
  } catch {
    return false
  }
}

export const createTrayStartupRetry = ({
  createTray,
  hasTray,
  shouldStop,
}: TrayStartupRetryOptions): TrayStartupRetry => {
  let retry: ReturnType<typeof setTimeout> | null = null
  let isChecking = false

  const start = (attempt = 0): void => {
    if (shouldStop() || hasTray() || retry !== null || isChecking) return

    isChecking = true
    void isStatusNotifierWatcherMissing()
      .then((watcherMissing) => {
        if (shouldStop() || hasTray()) return

        const delay = TRAY_STARTUP_RETRY_DELAYS_MS[attempt]
        if (watcherMissing && delay !== undefined) {
          retry = setTimeout(() => {
            retry = null
            start(attempt + 1)
          }, delay)
          return
        }

        createTray()
      })
      .finally(() => {
        isChecking = false
      })
  }

  return {
    start: () => start(),
    stop: () => {
      if (retry !== null) {
        clearTimeout(retry)
        retry = null
      }
    },
  }
}
