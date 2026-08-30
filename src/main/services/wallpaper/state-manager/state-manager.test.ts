import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChildProcess } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../../shared/constants/wallpaper'

// --- Mocks ---------------------------------------------------------------

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    // activeWallpapers defaults to an empty record; other keys are unset
    get: vi.fn((key: string) => (key === 'activeWallpapers' ? {} : undefined)),
    set: vi.fn(),
  },
}))

vi.mock('../../store', () => ({
  storeService: { activeWallpapers: mockStore },
}))

// Import after mocks (singleton reads the store on construction)
import { wallpaperStateManager } from './state-manager'

// --- Helpers -------------------------------------------------------------

const makeProc = (): ChildProcess =>
  ({ kill: vi.fn() }) as unknown as ChildProcess

const makeOptions = (backgroundId = '/wp/1'): ApplyWallpaperOptions => ({ backgroundId })

// --- Tests ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  wallpaperStateManager.reset()
})

describe('wallpaperStateManager paused state', () => {
  it('marks and reports paused screens', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())

    wallpaperStateManager.markPaused(['eDP-1'], true)

    expect(wallpaperStateManager.isPaused('eDP-1')).toBe(true)
    expect(wallpaperStateManager.getPausedScreens()).toEqual(['eDP-1'])
  })

  it('unmarks resumed screens', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.markPaused(['eDP-1'], false)

    expect(wallpaperStateManager.isPaused('eDP-1')).toBe(false)
    expect(wallpaperStateManager.getPausedScreens()).toEqual([])
  })

  it('expands pause marks to the whole process screen group', () => {
    wallpaperStateManager.register(['eDP-1', 'HDMI-1'], makeProc(), makeOptions())

    wallpaperStateManager.markPaused(['eDP-1'], true)

    expect(wallpaperStateManager.isPaused('HDMI-1')).toBe(true)
    expect(wallpaperStateManager.getPausedScreens()).toEqual(['eDP-1', 'HDMI-1'])
  })

  it('expands resume to the whole process screen group', () => {
    wallpaperStateManager.register(['eDP-1', 'HDMI-1'], makeProc(), makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.markPaused(['HDMI-1'], false)

    expect(wallpaperStateManager.getPausedScreens()).toEqual([])
  })

  it('persists paused screens to the store', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())

    wallpaperStateManager.markPaused(['eDP-1'], true)

    expect(mockStore.set).toHaveBeenCalledWith('pausedScreens', ['eDP-1'])
  })

  it('clears paused state when a screen is registered again', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())

    expect(wallpaperStateManager.isPaused('eDP-1')).toBe(false)
  })

  it('clears paused state when the process is released', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.release('eDP-1')

    expect(wallpaperStateManager.getPausedScreens()).toEqual([])
  })

  it('clears paused state when the process exits', () => {
    const proc = makeProc()
    wallpaperStateManager.register(['eDP-1'], proc, makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.cleanupExitedProcess(proc)

    expect(wallpaperStateManager.getPausedScreens()).toEqual([])
  })

  it('clears paused state on reset', () => {
    wallpaperStateManager.register(['eDP-1'], makeProc(), makeOptions())
    wallpaperStateManager.markPaused(['eDP-1'], true)

    wallpaperStateManager.reset()

    expect(wallpaperStateManager.getPausedScreens()).toEqual([])
  })
})
