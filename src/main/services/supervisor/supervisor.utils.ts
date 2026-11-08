import type { ChildProcess } from 'node:child_process'
import type { ScreenRecords, SavedScreens } from './supervisor.types'

/**
 * The signal that kills one backend handle. Under Flatpak the handle is
 * flatpak-spawn, which forwards SIGTERM to the host backend but would die
 * alone on SIGKILL.
 */
export const killSignal = (flatpak: boolean): NodeJS.Signals => (flatpak ? 'SIGTERM' : 'SIGKILL')

/** Screens whose record points at `proc`. */
export const screensDrivenBy = (records: ScreenRecords, proc: ChildProcess): string[] =>
  [...records].filter(([, record]) => record.proc === proc).map(([screen]) => screen)

/** The distinct backends behind `screens`, skipping screens without one. */
export const processesOf = (records: ScreenRecords, screens: Iterable<string>): Set<ChildProcess> =>
  new Set([...screens].flatMap((screen) => records.get(screen)?.proc ?? []))

/**
 * Take `screen` out of its former siblings' groups as it moves to a new
 * backend, so pausing one of them no longer marks it paused.
 */
export const leaveGroup = (records: ScreenRecords, screen: string): void => {
  for (const sibling of records.get(screen)?.group ?? []) {
    const record = records.get(sibling)
    if (sibling === screen || !record?.group.includes(screen)) continue
    record.group = record.group.filter((member) => member !== screen)
  }
}

/** Records for the screens a previous run saved. They have no process until respawned. */
export const recordsFromSaved = (saved: Partial<SavedScreens>): ScreenRecords => {
  const paused = new Set(saved.pausedScreens ?? [])
  const groups = saved.screenGroups ?? {}
  return new Map(
    Object.entries(saved.activeWallpapers ?? {}).map(([screen, options]) => [
      screen,
      { options, group: groups[screen] ?? [screen], paused: paused.has(screen) },
    ]),
  )
}

/** The saved form of `records`. Processes are not saved. */
export const toSavedScreens = (records: ScreenRecords): SavedScreens => {
  const saved: SavedScreens = { activeWallpapers: {}, pausedScreens: [], screenGroups: {} }
  for (const [screen, record] of records) {
    saved.activeWallpapers[screen] = record.options
    saved.screenGroups[screen] = record.group
    if (record.paused) saved.pausedScreens.push(screen)
  }
  return saved
}
