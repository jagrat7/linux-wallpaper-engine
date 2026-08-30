import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SystemThemePlatform } from './system-theme.interface'

const mocks = vi.hoisted(() => ({
  closeWatcher: vi.fn(),
  detectSystemTheme: vi.fn(),
  emitInvalidation: vi.fn(),
  watchThemeFiles: vi.fn(),
}))

vi.mock('../invalidation', () => ({
  invalidationService: { emit: mocks.emitInvalidation },
}))

vi.mock('./providers', () => ({ desktopThemeProviders: [] }))

vi.mock('./system-theme.utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('./system-theme.utils')>(),
  detectSystemTheme: mocks.detectSystemTheme,
  watchThemeFiles: mocks.watchThemeFiles,
}))

import { systemThemeService } from './system-theme'

afterEach(() => {
  systemThemeService.stopWatching()
  mocks.closeWatcher.mockClear()
  mocks.detectSystemTheme.mockReset()
  mocks.emitInvalidation.mockClear()
  mocks.watchThemeFiles.mockReset()
})

describe('system theme events', () => {
  it('refreshes from platform events and disposes every subscription', async () => {
    let scheme: 'light' | 'dark' = 'dark'
    let notifyChange = () => { throw new Error('Platform was not subscribed') }
    const unsubscribe = vi.fn()
    const platform = {
      readScheme: () => scheme,
      subscribe: vi.fn((onChange) => {
        notifyChange = onChange
        return unsubscribe
      }),
    } satisfies SystemThemePlatform
    mocks.detectSystemTheme.mockImplementation(async (_, platformScheme) => ({
      scheme: platformScheme,
      palette: null,
    }))
    mocks.watchThemeFiles.mockReturnValue([{ close: mocks.closeWatcher }])

    systemThemeService.configurePlatform(platform)
    systemThemeService.startWatching()
    systemThemeService.startWatching()
    expect(platform.subscribe).toHaveBeenCalledOnce()

    await expect(systemThemeService.getTheme()).resolves.toEqual({
      scheme: 'dark',
      palette: null,
    })

    scheme = 'light'
    notifyChange()
    await vi.waitFor(() => {
      expect(mocks.emitInvalidation).toHaveBeenCalledWith('settings.systemTheme')
    })

    systemThemeService.stopWatching()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.closeWatcher).toHaveBeenCalledOnce()
  })
})
