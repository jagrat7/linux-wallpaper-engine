import type { ChildProcess } from 'node:child_process'
import { backendArgPattern, hostExecFileAsync, shouldUseFlatpakSpawn } from '../../utils/host'
import type { ScreenRecords, SavedScreens } from './supervisor.types'

// ── Finding backends by command line ───────────────────────────────────────

// Matches the backend executable itself, whether plain, absolute or Nix-wrapped.
// Needs -f: plain pgrep only sees the 15-char comm, which truncates the name.
export const BACKEND_PROCESS_PATTERN = '^[^ ]*linux-wallpaperengine[^ ]*( |$)'

/** Command lines of every running backend, including ones this instance has no handle for. */
export const listBackendProcesses = async (): Promise<string[]> => {
  const { stdout } = await hostExecFileAsync('pgrep', ['-af', BACKEND_PROCESS_PATTERN]).catch(
    () => ({ stdout: '' }),
  )
  return stdout.split('\n').filter((line) => line.trim().length > 0)
}

/**
 * The command-line pattern of the backend drawing on `screen`. A real screen is
 * found by its `--screen-root`. The window-mode `'default'` screen has none, so
 * it is found by the playlist or wallpaper it runs.
 */
export const screenPattern = (
  screen: string,
  { playlist, backgroundId }: { playlist?: string; backgroundId?: string },
): string | null => {
  if (screen !== 'default') return backendArgPattern('--screen-root', screen)
  if (playlist) return backendArgPattern('--playlist', playlist)
  return backgroundId ? backendArgPattern('--bg', backgroundId) : null
}

// ── Signals ────────────────────────────────────────────────────────────────

/**
 * The signal that kills one backend handle. Under Flatpak the handle is
 * flatpak-spawn, which forwards SIGTERM to the host backend but would die
 * alone on SIGKILL.
 */
export const killSignal = (flatpak: boolean): NodeJS.Signals => (flatpak ? 'SIGTERM' : 'SIGKILL')

/**
 * Freeze or resume a backend. Signals the handle when there is one outside
 * Flatpak; otherwise (a restored screen, or a handle that only reaches
 * flatpak-spawn) signals the host backend by `pattern`. Never falls back to the
 * bare executable name, which would hit every backend on the machine.
 */
export const signalBackend = async (
  signal: 'SIGSTOP' | 'SIGCONT',
  proc: ChildProcess | undefined,
  pattern: string | null,
): Promise<boolean> => {
  if (proc && !shouldUseFlatpakSpawn()) {
    try {
      return proc.kill(signal)
    } catch {
      return false
    }
  }
  if (!pattern) return false
  const flag = signal === 'SIGSTOP' ? '-STOP' : '-CONT'
  try {
    await hostExecFileAsync('pkill', [flag, '-f', pattern])
    return true
  } catch {
    return false
  }
}

// ── Screen records ─────────────────────────────────────────────────────────

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
