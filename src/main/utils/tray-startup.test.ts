import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrayStartupCoordinator } from './tray-startup'

describe('createTrayStartupCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for the Linux StatusNotifier watcher before creating the tray', async () => {
    const createTray = vi.fn()
    const getStatusNotifierWatcherStatus = vi
      .fn()
      .mockResolvedValueOnce('missing')
      .mockResolvedValueOnce('available')

    const coordinator = createTrayStartupCoordinator({
      createTray,
      getStatusNotifierWatcherStatus,
      retryDelayMs: 1000,
    })

    coordinator.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(getStatusNotifierWatcherStatus).toHaveBeenCalledTimes(1)
    expect(createTray).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)

    expect(getStatusNotifierWatcherStatus).toHaveBeenCalledTimes(2)
    expect(createTray).toHaveBeenCalledTimes(1)
  })

  it('creates the tray immediately when watcher status is unknown', async () => {
    const createTray = vi.fn()
    const getStatusNotifierWatcherStatus = vi.fn().mockResolvedValue('unknown')

    const coordinator = createTrayStartupCoordinator({
      createTray,
      getStatusNotifierWatcherStatus,
    })

    coordinator.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(createTray).toHaveBeenCalledTimes(1)
  })

  it('stops a pending retry', async () => {
    const createTray = vi.fn()
    const getStatusNotifierWatcherStatus = vi.fn().mockResolvedValue('missing')

    const coordinator = createTrayStartupCoordinator({
      createTray,
      getStatusNotifierWatcherStatus,
      retryDelayMs: 1000,
    })

    coordinator.start()
    await vi.advanceTimersByTimeAsync(0)
    coordinator.stop()
    await vi.advanceTimersByTimeAsync(1000)

    expect(getStatusNotifierWatcherStatus).toHaveBeenCalledTimes(1)
    expect(createTray).not.toHaveBeenCalled()
  })

  it('falls back to creating the tray after bounded missing-watcher retries', async () => {
    const createTray = vi.fn()
    const getStatusNotifierWatcherStatus = vi.fn().mockResolvedValue('missing')

    const coordinator = createTrayStartupCoordinator({
      createTray,
      getStatusNotifierWatcherStatus,
      maxAttempts: 1,
      retryDelayMs: 1000,
    })

    coordinator.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)

    expect(getStatusNotifierWatcherStatus).toHaveBeenCalledTimes(2)
    expect(createTray).toHaveBeenCalledTimes(1)
  })
})
