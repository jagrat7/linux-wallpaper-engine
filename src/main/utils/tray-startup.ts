import type { StatusNotifierWatcherStatus } from './status-notifier'

type TimerHandle = ReturnType<typeof setTimeout>

export interface TrayStartupCoordinator {
  start: () => void
  stop: () => void
}

interface TrayStartupCoordinatorOptions {
  createTray: () => void
  getStatusNotifierWatcherStatus: () => Promise<StatusNotifierWatcherStatus>
  maxAttempts?: number
  retryDelayMs?: number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
  onError?: (error: unknown) => void
}

export const createTrayStartupCoordinator = ({
  createTray,
  getStatusNotifierWatcherStatus,
  maxAttempts = 60,
  retryDelayMs = 1000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  onError,
}: TrayStartupCoordinatorOptions): TrayStartupCoordinator => {
  let retryTimer: TimerHandle | null = null
  let attempts = 0
  let isChecking = false
  let isCreated = false
  let stopped = false

  const scheduleRetry = (): void => {
    attempts += 1
    retryTimer = setTimeoutFn(() => {
      retryTimer = null
      void attempt()
    }, retryDelayMs)
  }

  const attempt = async (): Promise<void> => {
    if (stopped || isChecking || isCreated || retryTimer !== null) return

    isChecking = true

    try {
      const watcherStatus = await getStatusNotifierWatcherStatus()

      if (stopped || isCreated) return

      if (watcherStatus === 'missing' && attempts < maxAttempts) {
        scheduleRetry()
        return
      }

      createTray()
      isCreated = true
    } catch (error) {
      if (stopped || isCreated) return

      if (attempts < maxAttempts) {
        scheduleRetry()
        return
      }

      onError?.(error)
    } finally {
      isChecking = false
    }
  }

  return {
    start: () => {
      stopped = false
      void attempt()
    },
    stop: () => {
      stopped = true
      if (retryTimer !== null) {
        clearTimeoutFn(retryTimer)
        retryTimer = null
      }
    },
  }
}
