import { playlistService } from './playlist'
import { settingsService } from '../settings'
import type { Playlist, PlaylistMode, PlaylistScheduleEntry } from '../../../shared/constants/playlist'
import type { ApplyWallpaperOptions, WallpaperOverrides } from '../../../shared/constants/wallpaper'
import type { MutationResult } from '../wallpaper/wallpaper.types'

export interface SchedulerApplyFn {
  (options: ApplyWallpaperOptions): Promise<MutationResult>
}

export interface SchedulerStopFn {
  (screens?: string[]): Promise<MutationResult>
}

export interface SchedulerDeps {
  apply: SchedulerApplyFn
  stop: SchedulerStopFn
}

interface ActiveScheduler {
  playlistName: string
  screens: string[]
  apply: SchedulerApplyFn
  stop: SchedulerStopFn
  timeout: NodeJS.Timeout | null
  mode: PlaylistMode
  currentPath: string | null
  lastAppliedAt: number | null
}

const activeSchedulers = new Map<string, ActiveScheduler>()

let themeListenerAttached = false

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesSinceMidnight(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

async function getNativeTheme() {
  if (!process.versions.electron) return undefined
  try {
    const electron = await import('electron')
    return electron.nativeTheme
  } catch {
    return undefined
  }
}

async function attachThemeListener() {
  if (themeListenerAttached) return
  const nativeTheme = await getNativeTheme()
  if (!nativeTheme) return
  themeListenerAttached = true
  nativeTheme.on('updated', () => {
    for (const [name] of activeSchedulers) {
      const sched = activeSchedulers.get(name)
      if (!sched) continue
      run(name).catch(() => { /* no-op */ })
    }
  })
}

export function resolveCurrentScheduleEntry(
  schedule: PlaylistScheduleEntry[],
  mode: PlaylistMode,
  now = new Date(),
  isDark = false,
): PlaylistScheduleEntry | null {
  if (schedule.length === 0) return null

  if (mode === 'theme') {
    const match = schedule.find(e => e.theme === (isDark ? 'dark' : 'light'))
    return match ?? schedule[0]
  }

  const nowMin = minutesSinceMidnight(now)
  let candidate: PlaylistScheduleEntry | null = null
  let candidateMin = -1

  for (const entry of schedule) {
    if (!entry.time) continue
    const min = parseTime(entry.time)
    if (min <= nowMin && min > candidateMin) {
      if (entry.theme && entry.theme !== (isDark ? 'dark' : 'light')) continue
      candidate = entry
      candidateMin = min
    }
  }

  if (candidate) return candidate

  // Wrap around to the latest slot of the previous day
  let wrap: PlaylistScheduleEntry | null = null
  let wrapMin = -1
  for (const entry of schedule) {
    if (!entry.time) continue
    const min = parseTime(entry.time)
    if (min > wrapMin) {
      if (entry.theme && entry.theme !== (isDark ? 'dark' : 'light')) continue
      wrap = entry
      wrapMin = min
    }
  }

  return wrap
}

function msUntilNextTimeSlot(schedule: PlaylistScheduleEntry[], now = new Date()): number {
  const times = schedule
    .map(e => (e.time ? parseTime(e.time) : -1))
    .filter(m => m >= 0)
    .sort((a, b) => a - b)

  if (times.length === 0) return 24 * 60 * 60 * 1000

  const nowMin = minutesSinceMidnight(now)
  const next = times.find(t => t > nowMin)
  const secondsMs = now.getSeconds() * 1000 + now.getMilliseconds()

  if (next !== undefined) {
    return (next - nowMin) * 60 * 1000 - secondsMs
  }

  const first = times[0]
  return ((24 * 60 - nowMin) + first) * 60 * 1000 - secondsMs
}

async function scheduleNext(name: string) {
  const sched = activeSchedulers.get(name)
  if (!sched || sched.mode !== 'time') return

  const playlist = await playlistService.getPlaylist(name)
  if (!playlist) {
    stopPlaylistScheduler(name)
    return
  }

  const ms = msUntilNextTimeSlot(playlist.settings.schedule ?? [], new Date())
  if (ms <= 0) {
    // Defensive: if we landed on a slot boundary, recheck in a minute
    setTimeout(() => run(name, true), 60 * 1000)
    return
  }

  if (sched.timeout) clearTimeout(sched.timeout)
  sched.timeout = setTimeout(() => run(name, true), ms)
}

async function run(name: string, force = false) {
  const sched = activeSchedulers.get(name)
  if (!sched) return

  const playlist = await playlistService.getPlaylist(name)
  if (!playlist) {
    stopPlaylistScheduler(name)
    return
  }

  const activeEntries = playlistService.getActivePlaylistEntries()
  const stillActive = sched.screens.some(screen => activeEntries[screen]?.name === name)
  if (!force && !stillActive) {
    stopPlaylistScheduler(name)
    return
  }

  const nativeTheme = await getNativeTheme()
  const isDark = nativeTheme?.shouldUseDarkColors ?? false
  const entry = resolveCurrentScheduleEntry(
    playlist.settings.schedule ?? [],
    playlist.settings.mode,
    new Date(),
    isDark,
  )

  if (!entry) return

  const isSameAsCurrent = sched.currentPath === entry.wallpaperPath && sched.lastAppliedAt !== null
  if (isSameAsCurrent) {
    await scheduleNext(name)
    return
  }

  await sched.stop(sched.screens)

  for (const screen of sched.screens) {
    const options: ApplyWallpaperOptions = {
      backgroundId: entry.wallpaperPath,
      screen,
      overrides: playlist.settings.overrides,
    }
    const result = await sched.apply(options)
    if (!result.success) {
      console.warn(`[playlist-scheduler] failed to apply ${entry.wallpaperPath} on ${screen}: ${result.error ?? 'unknown'}`)
    }
  }

  sched.currentPath = entry.wallpaperPath
  sched.lastAppliedAt = Date.now()

  await scheduleNext(name)
}

export async function startPlaylistScheduler(
  name: string,
  playlist: Playlist,
  screens: string[],
  deps: SchedulerDeps,
): Promise<string[]> {
  stopPlaylistScheduler(name)

  const settings = await settingsService.loadSettings()
  const screenKeys = settings.windowMode ? ['default'] : screens

  const sched: ActiveScheduler = {
    playlistName: name,
    screens: screenKeys,
    apply: deps.apply,
    stop: deps.stop,
    timeout: null,
    mode: playlist.settings.mode,
    currentPath: null,
    lastAppliedAt: null,
  }

  activeSchedulers.set(name, sched)

  if (playlist.settings.mode === 'theme') {
    await attachThemeListener()
  }

  await run(name, true)
  return screenKeys
}

export function stopPlaylistScheduler(name: string): void {
  const sched = activeSchedulers.get(name)
  if (!sched) return
  if (sched.timeout) clearTimeout(sched.timeout)
  activeSchedulers.delete(name)
}
