import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockHostExecAsync } = vi.hoisted(() => ({
  mockHostExecAsync: vi.fn(),
}))

vi.mock('./host', () => ({
  hostExecAsync: mockHostExecAsync,
}))

import { getStatusNotifierWatcherStatus } from './status-notifier'

describe('getStatusNotifierWatcherStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns available when the watcher owns the bus name', async () => {
    mockHostExecAsync.mockResolvedValue({ stdout: '(true,)', stderr: '' })

    await expect(getStatusNotifierWatcherStatus()).resolves.toBe('available')
  })

  it('returns missing when the watcher does not own the bus name', async () => {
    mockHostExecAsync.mockResolvedValue({ stdout: '(false,)', stderr: '' })

    await expect(getStatusNotifierWatcherStatus()).resolves.toBe('missing')
  })

  it('returns unknown when the probe cannot run', async () => {
    mockHostExecAsync.mockRejectedValue(new Error('gdbus missing'))

    await expect(getStatusNotifierWatcherStatus()).resolves.toBe('unknown')
  })
})
