import type { ChildProcess } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../../shared/constants/wallpaper'
import type { DebugInfo } from '../wallpaper.types'

// ── State manager — owns process tracking and active wallpaper state ───────

export interface IStateManager {
  // Process + screen group tracking
  getProcess(screen: string): ChildProcess | undefined
  register(screens: string[], proc: ChildProcess, options: ApplyWallpaperOptions): void
  release(screen: string): { remaining: Array<{ screen: string; options: ApplyWallpaperOptions }> }
  cleanupExitedProcess(proc: ChildProcess): { screens: string[] }

  // Active wallpaper state
  getActive(): ReadonlyMap<string, ApplyWallpaperOptions>
  isActive(backgroundId: string): boolean
  save(): void
  reset(): void

  // Applied history (drives the "recent" sort)
  getAppliedHistory(): Record<string, number>
  recordApplied(backgroundId: string): void

  // Debug
  getDebugLogs(screen: string): DebugInfo
  setDebugLogs(screen: string, command: string, logs: string[]): void
  clearDebugLogs(screen: string): void
}
