import type { ChildProcess } from 'node:child_process'
import { hostCommandExists, hostSpawn } from '../utils/host'
import type { WallpaperOverrides } from '../../shared/constants/wallpaper'
import {
  type CompatibilityStatus,
  type ScanProgress,
  DEFAULT_SCAN_PROGRESS,
  BROKEN_PATTERNS,
  MINOR_PATTERNS,
  COMPAT_IGNORE_PATTERNS,
  COMPATIBILITY_SEVERITY,
} from '../../shared/constants/compatibility'
import { storeService } from './store'
import { invalidationService } from './invalidation'

class CompatibilityService {
  private static instance: CompatibilityService | null = null
  private overridesStore = storeService.wallpaperOverrides
  private scanProgress: ScanProgress = { ...DEFAULT_SCAN_PROGRESS }

  static getInstance(): CompatibilityService {
    if (!CompatibilityService.instance) {
      CompatibilityService.instance = new CompatibilityService()
    }
    return CompatibilityService.instance
  }

  parseStderrToStatus(stderr: string, processExitedEarly: boolean): { status: CompatibilityStatus; errors: string[] } {
    const errors: string[] = []
    const lines = stderr.split('\n').filter(l => {
      const trimmed = l.trim()
      if (!trimmed) return false
      // Skip known harmless messages (e.g. Wayland GLFW warnings)
      if (COMPAT_IGNORE_PATTERNS.some(p => p.test(trimmed))) return false
      return true
    })

    for (const line of lines) {
      if (BROKEN_PATTERNS.some(p => p.test(line))) {
        errors.push(line.trim())
        return { status: 'broken', errors }
      }
    }

    if (processExitedEarly) {
      return { status: 'broken', errors: errors.length > 0 ? errors : ['Process exited unexpectedly'] }
    }

    for (const line of lines) {
      if (MINOR_PATTERNS.some(p => p.test(line))) {
        errors.push(line.trim())
      }
    }

    if (errors.length > 0) {
      return { status: 'minor', errors }
    }

    return { status: 'perfect', errors: [] }
  }

  monitorProcess(proc: ChildProcess, wallpaperPath: string): void {
    const overrides = this.getOverrides(wallpaperPath)
    if (overrides.compatibility) return

    let stderrData = ''

    const classify = (exitedEarly: boolean) => {
      const { status, errors } = this.parseStderrToStatus(stderrData, exitedEarly)
      this.updateAutoCompatibility(wallpaperPath, status, errors)
    }

    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString()
        classify(false)
      })
    }

    proc.on('exit', (_code, signal) => {
      if (signal) return
      classify(true)
    })

    proc.on('error', (error) => {
      stderrData += error.message
      classify(true)
    })
  }

  private updateAutoCompatibility(wallpaperPath: string, status: CompatibilityStatus, errors: string[]): void {
    const all = this.overridesStore.get('overrides')
    const existing = all[wallpaperPath] ?? {}
    const existingCompatibility = existing.compatibility
    const hasAutoResult = existing.autoErrors !== undefined
    const shouldUpdate = !existingCompatibility
      || (hasAutoResult && COMPATIBILITY_SEVERITY[status] > COMPATIBILITY_SEVERITY[existingCompatibility])

    if (!shouldUpdate) return

    all[wallpaperPath] = {
      ...existing,
      compatibility: status,
      autoErrors: errors,
      lastTested: Date.now(),
    }
    this.overridesStore.set('overrides', all)
    invalidationService.emit('wallpaper.getCompatibilityMap')
  }

  setCompatibility(wallpaperPath: string, status: CompatibilityStatus): void {
    const all = this.overridesStore.get('overrides')
    const existing = all[wallpaperPath] ?? {}
    const manualOverrides = { ...existing }
    delete manualOverrides.autoErrors

    all[wallpaperPath] = {
      ...manualOverrides,
      compatibility: status,
      lastTested: Date.now(),
    }
    this.overridesStore.set('overrides', all)
  }

  getCompatibilityMap(): Record<string, CompatibilityStatus> {
    const all = this.overridesStore.get('overrides')
    const map: Record<string, CompatibilityStatus> = {}
    for (const [key, value] of Object.entries(all)) {
      if (value.compatibility) {
        map[key] = value.compatibility
      }
    }
    return map
  }

  getScanReport(): { path: string; status: CompatibilityStatus; errors: string[]; lastTested: number }[] {
    const all = this.overridesStore.get('overrides')
    const results: { path: string; status: CompatibilityStatus; errors: string[]; lastTested: number }[] = []
    for (const [path, value] of Object.entries(all)) {
      if (value.compatibility && value.lastTested) {
        results.push({
          path,
          status: value.compatibility,
          errors: value.autoErrors ?? [],
          lastTested: value.lastTested,
        })
      }
    }
    return results.sort((a, b) => b.lastTested - a.lastTested)
  }

  getScanProgress(): ScanProgress {
    return { ...this.scanProgress }
  }

  abortScan(): void {
    this.scanProgress.aborted = true
  }

  async scanAll(wallpapers: { title: string; path: string }[]): Promise<{ total: number; scanned: number }> {
    if (this.scanProgress.running) {
      return { total: this.scanProgress.total, scanned: this.scanProgress.scanned }
    }

    const backendInstalled = await hostCommandExists('linux-wallpaperengine')
    if (!backendInstalled) {
      return { total: 0, scanned: 0 }
    }

    const overrides = this.overridesStore.get('overrides')
    const toScan = wallpapers.filter(w => !overrides[w.path]?.compatibility)

    this.scanProgress = {
      running: true,
      current: '',
      total: toScan.length,
      scanned: 0,
      aborted: false,
    }

    const concurrency = 3
    let index = 0

    const scanOne = async (wallpaper: { title: string; path: string }): Promise<void> => {
      if (this.scanProgress.aborted) return

      this.scanProgress.current = wallpaper.title

      return new Promise<void>((resolve) => {
        const proc = hostSpawn('linux-wallpaperengine', [
          '--window', '0x0x1x1',
          '--silent',
          wallpaper.path,
        ], {
          detached: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        })

        let stderrData = ''
        let resolved = false

        const finish = (exitedEarly: boolean) => {
          if (resolved) return
          resolved = true

          const { status, errors } = this.parseStderrToStatus(stderrData, exitedEarly)
          this.updateAutoCompatibility(wallpaper.path, status, errors)
          this.scanProgress.scanned++

          try { proc.kill('SIGKILL') } catch { /* already dead */ }
          resolve()
        }

        if (proc.stderr) {
          proc.stderr.on('data', (chunk: Buffer) => {
            stderrData += chunk.toString()
          })
        }

        proc.on('exit', () => finish(true))
        proc.on('error', () => finish(true))

        setTimeout(() => finish(false), 5000)
      })
    }

    const runBatch = async () => {
      while (index < toScan.length && !this.scanProgress.aborted) {
        const batch = toScan.slice(index, index + concurrency)
        index += concurrency
        await Promise.all(batch.map(scanOne))
      }
    }

    await runBatch()

    const result = { total: this.scanProgress.total, scanned: this.scanProgress.scanned }
    this.scanProgress = { ...DEFAULT_SCAN_PROGRESS }
    return result
  }

  private getOverrides(wallpaperPath: string): WallpaperOverrides {
    const all = this.overridesStore.get('overrides')
    return all[wallpaperPath] ?? {}
  }
}

export const compatibilityService = CompatibilityService.getInstance()
