import type { ChildProcess } from 'node:child_process'
import type { ApplyWallpaperOptions } from '../../../../shared/constants/wallpaper'
import type { IStateManager } from './state-manger.interface'
import type { DebugInfo } from '../wallpaper.types'
import { storeService } from '../../store'

class WallpaperStateManager implements IStateManager {
  private static instance: WallpaperStateManager | null = null

  private runningProcesses = new Map<string, ChildProcess>()
  private processScreenGroups = new Map<ChildProcess, Set<string>>()
  private activeWallpapers = new Map<string, ApplyWallpaperOptions>()
  private pausedScreens = new Set<string>()
  private screenGroups = new Map<string, string[]>()
  private debugLogs = new Map<string, string[]>()
  private debugCommands = new Map<string, string>()
  private store = storeService.activeWallpapers

  private constructor() {
    this.restore()
  }

  static getInstance(): WallpaperStateManager {
    if (!WallpaperStateManager.instance) {
      WallpaperStateManager.instance = new WallpaperStateManager()
    }
    return WallpaperStateManager.instance
  }

  // ── Restore from disk ──────────────────────────────────────────────────

  private restore(): void {
    const stored = this.store.get('activeWallpapers')
    for (const [screen, options] of Object.entries(stored)) {
      this.activeWallpapers.set(screen, options)
    }
    for (const screen of this.store.get('pausedScreens') ?? []) {
      this.pausedScreens.add(screen)
    }
    for (const [screen, group] of Object.entries(this.store.get('screenGroups') ?? {})) {
      this.screenGroups.set(screen, group)
    }
  }

  // ── Process + screen group tracking ────────────────────────────────────

  getProcess(screen: string): ChildProcess | undefined {
    return this.runningProcesses.get(screen)
  }

  register(screens: string[], proc: ChildProcess, options: ApplyWallpaperOptions): void {
    const screenSet = new Set(screens)
    this.processScreenGroups.set(proc, screenSet)
    for (const screen of screens) {
      this.runningProcesses.set(screen, proc)
      this.activeWallpapers.set(screen, { ...options, screen })
      this.screenGroups.set(screen, screens)
      // A freshly spawned process always starts unpaused — register is a
      // new process, not a resume of the previous frozen one
      this.pausedScreens.delete(screen)
    }
    this.save()
  }

  release(screen: string): { remaining: Array<{ screen: string, options: ApplyWallpaperOptions }> } {
    const proc = this.runningProcesses.get(screen)
    if (!proc) return { remaining: [] }

    const group = this.processScreenGroups.get(proc)

    // Collect remaining screens before cleanup
    const remaining: Array<{ screen: string, options: ApplyWallpaperOptions }> = []
    if (group) {
      for (const s of group) {
        if (s === screen) continue
        const opts = this.activeWallpapers.get(s)
        if (opts) remaining.push({ screen: s, options: opts })
      }
    }

    // Kill the process
    try { proc.kill('SIGKILL') } catch { /* already dead */ }

    // Clean up all screens that shared this process
    if (group) {
      for (const s of group) {
        if (this.runningProcesses.get(s) === proc) {
          this.runningProcesses.delete(s)
        }
        this.pausedScreens.delete(s)
        this.screenGroups.delete(s)
      }
      this.processScreenGroups.delete(proc)
    }

    // Remove the released screen from active wallpapers
    this.activeWallpapers.delete(screen)
    this.pausedScreens.delete(screen)
    this.screenGroups.delete(screen)
    this.save()

    return { remaining }
  }

  releaseMany(screens: string[]): { remaining: Array<{ screen: string, options: ApplyWallpaperOptions }>, released: string[] } {
    const targets = new Set(screens)
    const remaining: Array<{ screen: string, options: ApplyWallpaperOptions }> = []
    const released: string[] = []
    const procs = new Set<ChildProcess>()

    for (const screen of targets) {
      const proc = this.runningProcesses.get(screen)
      if (proc) procs.add(proc)
      if (this.activeWallpapers.has(screen)) released.push(screen)
    }

    for (const proc of procs) {
      const group = this.processScreenGroups.get(proc)
      if (group) {
        for (const screen of group) {
          if (targets.has(screen)) continue
          const opts = this.activeWallpapers.get(screen)
          if (opts) remaining.push({ screen, options: opts })
        }
        for (const screen of group) {
          if (this.runningProcesses.get(screen) === proc) {
            this.runningProcesses.delete(screen)
          }
          this.pausedScreens.delete(screen)
          this.screenGroups.delete(screen)
        }
        this.processScreenGroups.delete(proc)
      }
      try { proc.kill('SIGKILL') } catch { /* already dead */ }
    }

    // Always drop paused/group state for requested screens, even when no
    // process handle exists (e.g. state restored after an app restart)
    for (const screen of targets) {
      this.activeWallpapers.delete(screen)
      this.pausedScreens.delete(screen)
      this.screenGroups.delete(screen)
    }
    this.save()

    return { remaining, released }
  }

  // Remove a process and all of its screens from the active state without
  // killing it. Used when a process exits unexpectedly so it no longer shows
  // as applied. No-op when state has already been released by an explicit stop.
  cleanupExitedProcess(proc: ChildProcess): { screens: string[] } {
    const group = this.processScreenGroups.get(proc)
    if (!group) return { screens: [] }

    const cleanedScreens: string[] = []
    for (const screen of group) {
      if (this.runningProcesses.get(screen) === proc) {
        this.runningProcesses.delete(screen)
      }
      this.pausedScreens.delete(screen)
      this.screenGroups.delete(screen)
      if (this.activeWallpapers.has(screen)) {
        this.activeWallpapers.delete(screen)
        cleanedScreens.push(screen)
      }
    }
    this.processScreenGroups.delete(proc)
    this.save()
    return { screens: cleanedScreens }
  }

  // ── Active wallpaper state ─────────────────────────────────────────────

  getActive(): ReadonlyMap<string, ApplyWallpaperOptions> {
    return this.activeWallpapers
  }

  isActive(backgroundId: string): boolean {
    if (this.runningProcesses.size === 0) return false
    return [...this.activeWallpapers.values()].some(w => w.backgroundId === backgroundId)
  }

  save(): void {
    const obj: Record<string, ApplyWallpaperOptions> = {}
    for (const [screen, options] of this.activeWallpapers.entries()) {
      obj[screen] = options
    }
    this.store.set('activeWallpapers', obj)
    this.store.set('pausedScreens', [...this.pausedScreens])
    const groups: Record<string, string[]> = {}
    for (const [screen, group] of this.screenGroups.entries()) {
      groups[screen] = group
    }
    this.store.set('screenGroups', groups)
  }

  reset(): void {
    for (const proc of this.processScreenGroups.keys()) {
      try { proc.kill('SIGKILL') } catch { /* already dead */ }
    }
    this.processScreenGroups.clear()
    this.runningProcesses.clear()
    this.activeWallpapers.clear()
    this.pausedScreens.clear()
    this.screenGroups.clear()
    this.save()
  }

  // ── Paused (frozen) process state ──────────────────────────────────────

  getPausedScreens(): string[] {
    return [...this.pausedScreens]
  }

  isPaused(screen: string): boolean {
    return this.pausedScreens.has(screen)
  }

  // Mark screens as paused/unpaused. A screen shares its process with its
  // whole screen group, so pausing one screen freezes (and unpausing unfreezes)
  // every screen in that group — expand the mark accordingly.
  markPaused(screens: string[], paused: boolean): void {
    const targets = new Set<string>()
    for (const screen of screens) {
      const proc = this.runningProcesses.get(screen)
      const liveGroup = proc ? this.processScreenGroups.get(proc) : undefined
      const restoredGroup = this.screenGroups.get(screen)
      for (const s of liveGroup ?? restoredGroup ?? [screen]) {
        targets.add(s)
      }
    }
    for (const screen of targets) {
      if (paused) {
        this.pausedScreens.add(screen)
      } else {
        this.pausedScreens.delete(screen)
      }
    }
    this.save()
  }

  // ── Applied history ────────────────────────────────────────────────────

  getAppliedHistory(): Record<string, number> {
    return this.store.get('appliedHistory') ?? {}
  }

  recordApplied(backgroundId: string): void {
    const history = this.getAppliedHistory()
    this.store.set('appliedHistory', { ...history, [backgroundId]: Date.now() })
  }

  // ── Debug ──────────────────────────────────────────────────────────────

  getDebugLogs(screen: string): DebugInfo {
    return {
      command: this.debugCommands.get(screen) ?? '',
      logs: this.debugLogs.get(screen) ?? [],
    }
  }

  setDebugLogs(screen: string, command: string, logs: string[]): void {
    this.debugCommands.set(screen, command)
    this.debugLogs.set(screen, logs)
  }

  clearDebugLogs(screen: string): void {
    this.debugLogs.delete(screen)
    this.debugCommands.delete(screen)
  }
}

export const wallpaperStateManager = WallpaperStateManager.getInstance()
