import { ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vite-plus/test'
import type { ScreenRecords } from './supervisor.types'
import {
  killSignal,
  leaveGroup,
  processesOf,
  recordsFromSaved,
  screensDrivenBy,
  toSavedScreens,
} from './supervisor.utils'

// An unspawned handle: only its identity matters here
const makeProc = () => new ChildProcess()

const sharedRecords = (proc: ChildProcess): ScreenRecords => {
  const group = ['eDP-1', 'HDMI-1']
  return new Map([
    ['eDP-1', { options: { backgroundId: '/wp/1' }, group, paused: false, proc }],
    ['HDMI-1', { options: { backgroundId: '/wp/1' }, group, paused: true, proc }],
    ['DP-2', { options: { backgroundId: '/wp/2' }, group: ['DP-2'], paused: false }],
  ])
}

describe('killSignal', () => {
  it('sends SIGTERM under Flatpak for flatpak-spawn to forward, SIGKILL otherwise', () => {
    expect(killSignal(true)).toBe('SIGTERM')
    expect(killSignal(false)).toBe('SIGKILL')
  })
})

describe('screensDrivenBy and processesOf', () => {
  it('maps between a backend and the screens it draws on', () => {
    const proc = makeProc()
    const records = sharedRecords(proc)

    expect(screensDrivenBy(records, proc)).toEqual(['eDP-1', 'HDMI-1'])
    expect([...processesOf(records, ['eDP-1', 'HDMI-1', 'DP-2', 'missing'])]).toEqual([proc])
  })
})

describe('leaveGroup', () => {
  it('removes a moving screen from its former siblings only', () => {
    const records = sharedRecords(makeProc())

    leaveGroup(records, 'HDMI-1')

    expect(records.get('eDP-1')?.group).toEqual(['eDP-1'])
    expect(records.get('HDMI-1')?.group).toEqual(['eDP-1', 'HDMI-1'])
  })
})

describe('saved screens', () => {
  it('round-trips records through the store shape, without processes', () => {
    const records = sharedRecords(makeProc())

    const saved = toSavedScreens(records)
    const restored = recordsFromSaved(saved)

    expect(saved).toEqual({
      activeWallpapers: {
        'eDP-1': { backgroundId: '/wp/1' },
        'HDMI-1': { backgroundId: '/wp/1' },
        'DP-2': { backgroundId: '/wp/2' },
      },
      pausedScreens: ['HDMI-1'],
      screenGroups: {
        'eDP-1': ['eDP-1', 'HDMI-1'],
        'HDMI-1': ['eDP-1', 'HDMI-1'],
        'DP-2': ['DP-2'],
      },
    })
    expect(restored.get('HDMI-1')).toEqual({
      options: { backgroundId: '/wp/1' },
      group: ['eDP-1', 'HDMI-1'],
      paused: true,
    })
  })

  it('treats a screen saved without a group or pause mark as running alone', () => {
    const restored = recordsFromSaved({ activeWallpapers: { 'eDP-1': { backgroundId: '/wp/1' } } })

    expect(restored.get('eDP-1')).toEqual({
      options: { backgroundId: '/wp/1' },
      group: ['eDP-1'],
      paused: false,
    })
  })
})
