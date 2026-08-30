import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SystemTheme } from './system-theme.types'

const fileWatchMocks = vi.hoisted(() => ({
  callbacks: new Map<string, (_event: string, fileName: string | null) => void>(),
  existsSync: vi.fn(() => true),
  watch: vi.fn((directory, callback) => {
    fileWatchMocks.callbacks.set(directory, callback)
    return {
      close: vi.fn(),
      on: vi.fn().mockReturnThis(),
    }
  }),
}))

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: fileWatchMocks.existsSync,
  watch: fileWatchMocks.watch,
}))

import {
  normalizeSystemThemePalette,
  portal,
  themeRefresh,
  watchThemeFiles,
} from './system-theme.utils'

const darkTheme: SystemTheme = {
  scheme: 'dark',
  palette: { background: '#111111' },
}

const lightTheme: SystemTheme = {
  scheme: 'light',
  palette: { background: '#eeeeee' },
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeSystemThemePalette', () => {
  it('removes empty palette values while preserving usable colors', () => {
    expect(normalizeSystemThemePalette({
      background: '#101010',
      foreground: '',
      accent: undefined,
    })).toEqual({ background: '#101010' })
  })

  it('preserves a usable partial palette', () => {
    expect(normalizeSystemThemePalette({ accent: '#336699' })).toEqual({ accent: '#336699' })
  })

  it('rejects empty and missing palettes', () => {
    expect(normalizeSystemThemePalette({ background: '' })).toBeNull()
    expect(normalizeSystemThemePalette(null)).toBeNull()
  })
})

describe('portal.parseScheme', () => {
  it('parses dark and light portal values', () => {
    expect(portal.parseScheme('(<<uint32 1>>, )')).toBe('dark')
    expect(portal.parseScheme('u 2')).toBe('light')
  })

  it('treats unknown values as no preference', () => {
    expect(portal.parseScheme('uint32 0')).toBeNull()
    expect(portal.parseScheme('uint32 99')).toBeNull()
  })
})

describe('portal.parseAccent', () => {
  it('parses gdbus and busctl tuples', () => {
    expect(portal.parseAccent('(<(0.1, 0.2, 0.3)>,)')).toBe('color(srgb 0.1 0.2 0.3)')
    expect(portal.parseAccent('(ddd) 0.4 0.5 0.6')).toBe('color(srgb 0.4 0.5 0.6)')
  })

  it('rejects channels outside the portal range', () => {
    expect(portal.parseAccent('(1.1, 0.2, 0.3)')).toBeNull()
    expect(portal.parseAccent('double -0.1\ndouble 0.2\ndouble 0.3')).toBeNull()
  })
})

describe('watchThemeFiles', () => {
  it('groups files by directory and ignores unrelated file events', () => {
    const onChange = vi.fn()
    const watchers = watchThemeFiles([
      '/config/theme/colors.toml',
      '/config/theme/hyprland.lua',
      '/config/desktop/kdeglobals',
    ], onChange)

    expect(watchers).toHaveLength(2)
    expect(fileWatchMocks.watch).toHaveBeenCalledTimes(2)

    fileWatchMocks.callbacks.get('/config/theme')?.('change', 'unrelated.txt')
    expect(onChange).not.toHaveBeenCalled()

    fileWatchMocks.callbacks.get('/config/theme')?.('change', 'colors.toml')
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('themeRefresh', () => {
  it('serializes overlapping refreshes and runs one trailing detection', async () => {
    const first = deferred<SystemTheme>()
    const second = deferred<SystemTheme>()
    const detect = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const coordinator = themeRefresh.createCoordinator({
      detect,
      debounceMs: 100,
      onChange: vi.fn(),
    })

    const firstRefresh = coordinator.refresh()
    const overlappingRefresh = coordinator.refresh()

    expect(firstRefresh).toBe(overlappingRefresh)
    expect(detect).toHaveBeenCalledTimes(1)

    first.resolve(darkTheme)
    await vi.waitFor(() => expect(detect).toHaveBeenCalledTimes(2))
    second.resolve(lightTheme)

    await expect(firstRefresh).resolves.toEqual(lightTheme)
    await expect(overlappingRefresh).resolves.toEqual(lightTheme)
  })

  it('coalesces file-triggered refresh requests', async () => {
    vi.useFakeTimers()
    const detect = vi.fn().mockResolvedValue(darkTheme)
    const coordinator = themeRefresh.createCoordinator({
      detect,
      debounceMs: 100,
      onChange: vi.fn(),
    })

    coordinator.requestDebouncedRefresh()
    await vi.advanceTimersByTimeAsync(60)
    coordinator.requestDebouncedRefresh()
    await vi.advanceTimersByTimeAsync(99)
    expect(detect).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('can cancel a pending file-triggered refresh', async () => {
    vi.useFakeTimers()
    const detect = vi.fn().mockResolvedValue(darkTheme)
    const coordinator = themeRefresh.createCoordinator({
      detect,
      debounceMs: 100,
      onChange: vi.fn(),
    })

    coordinator.requestDebouncedRefresh()
    coordinator.cancelDebouncedRefresh()
    await vi.advanceTimersByTimeAsync(100)

    expect(detect).not.toHaveBeenCalled()
  })

  it('invalidates only after a successful theme change', async () => {
    const onChange = vi.fn()
    const detect = vi.fn()
      .mockResolvedValueOnce(darkTheme)
      .mockResolvedValueOnce(darkTheme)
      .mockResolvedValueOnce(lightTheme)
    const coordinator = themeRefresh.createCoordinator({
      detect,
      debounceMs: 100,
      onChange,
    })

    await coordinator.refresh()
    await coordinator.refresh()
    expect(onChange).not.toHaveBeenCalled()

    await coordinator.refresh()
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(lightTheme)
  })

  it('serves the last successful theme after a detection error', async () => {
    const error = new Error('theme file is temporarily incomplete')
    const onChange = vi.fn()
    const onError = vi.fn()
    const detect = vi.fn()
      .mockResolvedValueOnce(darkTheme)
      .mockRejectedValueOnce(error)
    const coordinator = themeRefresh.createCoordinator({
      detect,
      debounceMs: 100,
      onChange,
      onError,
    })

    await coordinator.refresh()

    await expect(coordinator.refresh()).resolves.toEqual(darkTheme)
    expect(onChange).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('rejects a detection error when no successful theme is cached', async () => {
    const error = new Error('portal unavailable')
    const onError = vi.fn()
    const coordinator = themeRefresh.createCoordinator({
      detect: vi.fn().mockRejectedValue(error),
      debounceMs: 100,
      onChange: vi.fn(),
      onError,
    })

    await expect(coordinator.refresh()).rejects.toBe(error)
    expect(onError).toHaveBeenCalledWith(error)
  })
})
