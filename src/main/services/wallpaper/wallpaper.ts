import type { ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'
import { displayService } from '../display'
import { settingsService } from '../settings'
import { storeService, type ActivePlaylistInfo } from '../store'
import { hostSpawn, hostExecAsync } from '../flatpak'
import { STEAM_PATHS, CACHE_TTL, type WallpaperOverrides, type Wallpaper, type ApplyWallpaperOptions } from '../../../shared/constants'
import { CompatibilityService } from '../compatibility'
import { parseImageHeader } from './wallpaper.utils'

export type { Wallpaper, ApplyWallpaperOptions }

export interface GetWallpapersOptions {
  search?: string
  refresh?: boolean
}

// TODO: Simplify and organize this monstrosity 💀
class WallpaperService {
  private static instance: WallpaperService | null = null

  private wallpaperCache: Wallpaper[] | null = null
  private cacheTimestamp: number | null = null
  private runningProcesses: Map<string, ChildProcess> = new Map()
  private activeWallpapers: Map<string, ApplyWallpaperOptions> = new Map()
  private store = storeService.activeWallpapers
  private overridesStore = storeService.wallpaperOverrides

  private constructor() {
    this.restoreActiveWallpapers()
  }

  static getInstance(): WallpaperService {
    if (!WallpaperService.instance) {
      WallpaperService.instance = new WallpaperService()
    }
    return WallpaperService.instance
  }

  private restoreActiveWallpapers(): void {
    const stored = this.store.get('activeWallpapers')
    for (const [screen, options] of Object.entries(stored)) {
      this.activeWallpapers.set(screen, options)
    }

    // Check if wallpapers are actually running, reapply if not
    this.syncAndReapply()
  }

  private async syncAndReapply(): Promise<void> {
    if (this.activeWallpapers.size === 0) return

    try {
      const { stdout } = await hostExecAsync('pgrep -a linux-wallpaperengine').catch(() => ({ stdout: '' }))
      const processOutput = stdout.trim()

      for (const [screen] of this.activeWallpapers.entries()) {
        const isRunning = screen === 'default'
          ? processOutput.length > 0 && !processOutput.includes('--screen-root')
          : processOutput.includes(`--screen-root ${screen}`)

        if (!isRunning) {
          await this.reapplyActiveWallpapers()
          return
        }
      }
    } catch {
      // If pgrep fails, reapply to be safe
      await this.reapplyActiveWallpapers()
    }
  }

  // Get saved overrides for a specific wallpaper
  getWallpaperOverrides(wallpaperPath: string): WallpaperOverrides {
    const all = this.overridesStore.get('overrides')
    return all[wallpaperPath] ?? {}
  }

  private isWallpaperRunning(wallpaperPath: string): boolean {
    if (this.runningProcesses.size === 0) return false
    return [...this.activeWallpapers.values()].some(w => w.backgroundId === wallpaperPath)
  }

  private reapplyTimer: ReturnType<typeof setTimeout> | null = null

  private debouncedReapply(): void {
    if (this.reapplyTimer) clearTimeout(this.reapplyTimer)
    this.reapplyTimer = setTimeout(() => {
      this.reapplyActiveWallpapers()
    }, 500)
  }

  // Save overrides for a specific wallpaper and reapply if active
  async saveWallpaperOverrides(wallpaperPath: string, overrides: WallpaperOverrides): Promise<void> {
    const all = this.overridesStore.get('overrides')
    all[wallpaperPath] = overrides
    this.overridesStore.set('overrides', all)

    if (this.isWallpaperRunning(wallpaperPath)) {
      this.debouncedReapply()
    }
  }

  // Reset overrides for a specific wallpaper and reapply if active
  async resetWallpaperOverrides(wallpaperPath: string): Promise<void> {
    const all = this.overridesStore.get('overrides')
    delete all[wallpaperPath]
    this.overridesStore.set('overrides', all)

    if (this.isWallpaperRunning(wallpaperPath)) {
      await this.reapplyActiveWallpapers()
    }
  }

  private saveActiveWallpapers(): void {
    const wallpapersObj: Record<string, ApplyWallpaperOptions> = {}
    for (const [screen, options] of this.activeWallpapers.entries()) {
      wallpapersObj[screen] = options
    }
    this.store.set('activeWallpapers', wallpapersObj)
  }

  private expandPath(p: string): string {
    if (p.startsWith('~')) {
      return path.join(process.env.HOME ?? '', p.slice(1))
    }
    return p
  }

  async checkBackendInstalled(): Promise<boolean> {
    try {
      await hostExecAsync('which linux-wallpaperengine')
      return true
    } catch {
      return false
    }
  }

  private async scanWallpapers(): Promise<Wallpaper[]> {
    const workshopDirs: Set<string> = new Set()
    const wallpapers: Wallpaper[] = []
    const seen: Set<string> = new Set()

    // Search standard Steam paths
    for (const basePath of STEAM_PATHS) {
      const expanded = this.expandPath(basePath)

      // Workshop content (431960 is Wallpaper Engine's Steam app ID)
      const workshopPath = path.join(expanded, 'steamapps/workshop/content/431960')
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch {
        // Path doesn't exist, skip
      }

      // Default presets
      const presetsPath = path.join(expanded, 'steamapps/common/wallpaper_engine/assets/presets')
      try {
        await fs.access(presetsPath)
        workshopDirs.add(presetsPath)
      } catch {
        // Path doesn't exist, skip
      }
    }

    // Also check snap paths dynamically
    const snapPaths = await glob(this.expandPath('~/snap/steam/*/.local/share/Steam'))
    for (const snapPath of snapPaths) {
      const workshopPath = path.join(snapPath, 'steamapps/workshop/content/431960')
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch {
        // Skip
      }
    }

    // Scan each workshop directory for wallpapers
    for (const workshopDir of workshopDirs) {
      try {
        const items = await fs.readdir(workshopDir)

        for (const itemId of items) {
          if (seen.has(itemId)) continue

          const wallpaperPath = path.join(workshopDir, itemId)
          const projectFile = path.join(wallpaperPath, 'project.json')

          try {
            const projectData = await fs.readFile(projectFile, 'utf-8')
            const project = JSON.parse(projectData)

            // Calculate total file size using du command
            let fileSize = 0
            try {
              const { stdout } = await hostExecAsync(`du -sb "${wallpaperPath}"`)
              fileSize = parseInt(stdout.split('\t')[0], 10) || 0
            } catch {
              // Ignore size errors
            }

            // Get directory modification time as date added
            let dateAdded = 0
            try {
              const stat = await fs.stat(wallpaperPath)
              dateAdded = stat.mtimeMs
            } catch {
              // Ignore stat errors
            }

            // Determine wallpaper type
            let type: Wallpaper['type'] = 'scene'
            if (project.type) {
              const typeMap: Record<string, Wallpaper['type']> = {
                scene: 'scene',
                video: 'video',
                web: 'web',
                application: 'application',
              }
              type = typeMap[project.type.toLowerCase()] ?? 'scene'
            }

            // Build thumbnail path
            let thumbnail = ''
            if (project.preview) {
              thumbnail = path.join(wallpaperPath, project.preview)
            }

            // Get resolution from media files
            const resolution = await this.detectResolution(wallpaperPath)

            wallpapers.push({
              id: itemId,
              workshopId: itemId,
              title: project.title ?? 'Untitled',
              author: project.author ?? (project.workshopurl ? 'Workshop' : 'Unknown'),
              type,
              thumbnail,
              previewUrl: project.preview ? path.join(wallpaperPath, project.preview) : undefined,
              resolution,
              fileSize,
              dateAdded,
              tags: project.tags ?? [],
              installed: true,
              path: wallpaperPath,
            })

            seen.add(itemId)
          } catch {
            // Skip wallpapers without valid project.json
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    // Sort by title
    wallpapers.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))

    return wallpapers
  }

  private async detectResolution(wallpaperPath: string): Promise<{ width: number; height: number }> {
    try {
      const files = await fs.readdir(wallpaperPath)

      // Look for video files first
      const videoFile = files.find(f => {
        const file = f.toLowerCase()
        return file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.avi') || file.endsWith('.mkv')
      })

      if (videoFile) {
        const videoPath = path.join(wallpaperPath, videoFile)
        const { stdout } = await hostExecAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`)
        const [w, h] = stdout.trim().split(',')
        if (w && h) {
          return { width: parseInt(w, 10), height: parseInt(h, 10) }
        }
      } else {
        // Look for image files (excluding preview thumbnails)
        const imageFile = files.find(f => {
          const file = f.toLowerCase()
          return (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.bmp')) &&
            !file.includes('preview')
        })

        if (imageFile) {
          const imagePath = path.join(wallpaperPath, imageFile)
          const { stdout } = await hostExecAsync(`file "${imagePath}"`)
          const match = stdout.match(/(\d+)\s*x\s*(\d+)/)
          if (match) {
            return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) }
          }
          return parseImageHeader(imagePath)
        }
      }
    } catch {
      // Keep 0x0 if detection fails
    }

    return { width: 0, height: 0 }
  }

  async getWallpapers(options: GetWallpapersOptions = {}): Promise<Wallpaper[]> {
    const { search, refresh = false } = options

    // Check if we need to refresh cache
    const now = Date.now()
    const cacheExpired = !this.cacheTimestamp || (now - this.cacheTimestamp) > CACHE_TTL

    if (refresh || !this.wallpaperCache || cacheExpired) {
      this.wallpaperCache = await this.scanWallpapers()
      this.cacheTimestamp = now
    }

    let filtered = this.wallpaperCache

    // Apply search
    if (search?.trim()) {
      const searchLower = search.toLowerCase().trim()
      filtered = filtered.filter(w =>
        w.title.toLowerCase().includes(searchLower) ||
        w.author.toLowerCase().includes(searchLower) ||
        w.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    return filtered
  }

  async applyWallpaper(options: ApplyWallpaperOptions): Promise<{ success: boolean; error?: string }> {
    const args: string[] = []

    // Per-wallpaper overrides take priority over options (which already have global settings merged)
    const overrides = this.getWallpaperOverrides(options.backgroundId)
    const volume = overrides.volume ?? options.volume
    const noAudioProcessing = overrides.audioProcessing !== undefined
      ? !overrides.audioProcessing
      : options.noAudioProcessing
    const disableMouse = overrides.disableMouse ?? options.disableMouse
    const disableParallax = overrides.disableParallax ?? options.disableParallax
    const scaling = overrides.scaling ?? options.scaling

    let targetScreen = options.screen
    if (options.windowed) {
      const { x, y, width, height } = options.windowed
      args.push('--window', `${x}x${y}x${width}x${height}`)
    } else {
      if (!targetScreen) {
        try {
          const displays = await displayService.detectDisplays()
          const primary = displays.find((d) => d.primary) ?? displays[0]
          if (primary) {
            targetScreen = primary.name
          }
        } catch {
          targetScreen = 'eDP-1'
        }
      }
      if (targetScreen) {
        args.push('--screen-root', targetScreen)
      }
    }

    args.push('--bg', options.backgroundId)

    if (options.silent) {
      args.push('--silent')
    } else if (volume !== undefined) {
      args.push('--volume', volume.toString())
    }

    if (options.noAutomute) args.push('--noautomute')
    if (noAudioProcessing) args.push('--no-audio-processing')
    if (options.fps) args.push('--fps', options.fps.toString())
    if (disableMouse) args.push('--disable-mouse')
    if (disableParallax) args.push('--disable-parallax')
    if (options.noFullscreenPause) args.push('--no-fullscreen-pause')
    if (scaling && scaling !== 'default') args.push('--scaling', scaling)

    try {
      const screenKey = targetScreen ?? 'default'

      // Kill existing process for this screen
      const existing = this.runningProcesses.get(screenKey)
      if (existing) {
        existing.kill('SIGKILL')
        this.runningProcesses.delete(screenKey)
      }

      // Also kill any orphaned linux-wallpaperengine processes for this screen
      try {
        if (targetScreen) {
          await hostExecAsync(`pkill -9 -f "linux-wallpaperengine.*--screen-root.*${targetScreen}"`)
        }
      } catch {
        // pkill returns error if no process found, that's ok
      }

      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      const proc = hostSpawn('linux-wallpaperengine', args, {
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      })

      proc.unref()
      CompatibilityService.getInstance().monitorProcess(proc, options.backgroundId)
      this.runningProcesses.set(screenKey, proc)
      this.activeWallpapers.set(screenKey, options)
      this.clearActivePlaylist() // single wallpaper overrides any playlist
      this.saveActiveWallpapers()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply wallpaper',
      }
    }
  }

  async stopWallpaper(screen?: string): Promise<{ success: boolean }> {
    if (screen) {
      const proc = this.runningProcesses.get(screen)
      if (proc) {
        proc.kill('SIGKILL')
      }
      this.runningProcesses.delete(screen)
      this.activeWallpapers.delete(screen)
      this.clearActivePlaylistForScreen(screen)
      this.saveActiveWallpapers()

      // Also kill any orphaned processes for this screen
      try {
        await hostExecAsync(`pkill -9 -f "linux-wallpaperengine.*--screen-root.*${screen}"`)
      } catch {
        // No process found is ok
      }
    } else {
      // Clear all tracking state first
      this.runningProcesses.clear()
      this.activeWallpapers.clear()
      this.clearActivePlaylist()
      this.saveActiveWallpapers()

      // Then attempt to kill all processes
      try {
        await hostExecAsync('pkill -9 -f linux-wallpaperengine')
      } catch {
        // No process found is ok
      }
    }
    return { success: true }
  }

  /**
   * Register an externally-spawned process (e.g. playlist mode) so it is
   * tracked for stop/restore/status just like applyWallpaper does.
   */
  registerProcess(screen: string, proc: ChildProcess, options: ApplyWallpaperOptions): void {
    const screenKey = screen ?? 'default'

    // Kill any existing process for this screen first
    const existing = this.runningProcesses.get(screenKey)
    if (existing) {
      existing.kill('SIGKILL')
      this.runningProcesses.delete(screenKey)
    }

    proc.unref()
    this.runningProcesses.set(screenKey, proc)
    this.activeWallpapers.set(screenKey, options)
    this.saveActiveWallpapers()
  }

  // ── Playlist tracking ────────────────────────────────────────────────

  setActivePlaylist(name: string, screen: string): void {
    this.store.set('activePlaylist', { name, screen })
  }

  getActivePlaylist(): ActivePlaylistInfo | null {
    return this.store.get('activePlaylist')
  }

  clearActivePlaylist(): void {
    this.store.set('activePlaylist', null)
  }

  private clearActivePlaylistForScreen(screen: string): void {
    const active = this.getActivePlaylist()
    if (active?.screen === screen) {
      this.clearActivePlaylist()
    }
  }

  getActiveWallpapers(): Map<string, ApplyWallpaperOptions> {
    return this.activeWallpapers
  }

  async getActiveWallpapersWithTitles(): Promise<Array<{
    screen: string
    wallpaper: ApplyWallpaperOptions
    title: string
    thumbnail: string
  }>> {
    const result: Array<{
      screen: string
      wallpaper: ApplyWallpaperOptions
      title: string
      thumbnail: string
    }> = []

    const allWallpapers = await this.getWallpapers()

    for (const [screen, wallpaper] of this.activeWallpapers.entries()) {
      if (!this.runningProcesses.has(screen)) continue
      const cachedWallpaper = allWallpapers.find(w => w.path === wallpaper.backgroundId)
      const title = cachedWallpaper?.title ?? wallpaper.backgroundId.split('/').filter(Boolean).pop() ?? 'Unknown'

      // Try to get thumbnail from cache, or build it from project.json
      let thumbnail = cachedWallpaper?.thumbnail ?? ''
      if (!thumbnail && wallpaper.backgroundId) {
        try {
          const projectPath = path.join(wallpaper.backgroundId, 'project.json')
          const projectData = await fs.readFile(projectPath, 'utf-8')
          const project = JSON.parse(projectData)
          if (project.preview) {
            thumbnail = path.join(wallpaper.backgroundId, project.preview)
          }
        } catch {
          // Fallback: try common preview filenames
          const previewCandidates = ['preview.jpg', 'preview.png', 'preview.gif']
          for (const candidate of previewCandidates) {
            const candidatePath = path.join(wallpaper.backgroundId, candidate)
            try {
              await fs.access(candidatePath)
              thumbnail = candidatePath
              break
            } catch {
              // Continue to next candidate
            }
          }
        }
      }

      result.push({ screen, wallpaper, title, thumbnail })
    }

    return result
  }

  async reapplyActiveWallpapers(): Promise<{ success: boolean; errors?: string[] }> {
    const errors: string[] = []
    const settings = await settingsService.loadSettings()

    for (const [screenKey, baseOptions] of this.activeWallpapers.entries()) {
      const options: ApplyWallpaperOptions = {
        ...baseOptions,
        // Ensure we target the correct screen that this wallpaper is assigned to
        screen: screenKey !== 'default' ? screenKey : baseOptions.screen,
        fps: settings.fps,
        volume: settings.volume,
        silent: settings.silent,
        noAutomute: settings.noAutomute,
        noAudioProcessing: !settings.audioProcessing,
        // Respect per-wallpaper scaling if set, otherwise use default
        scaling: baseOptions.scaling && baseOptions.scaling !== 'default' ? baseOptions.scaling : settings.defaultScaling,
        disableMouse: settings.disableMouse,
        disableParallax: settings.disableParallax,
        noFullscreenPause: !settings.pauseOnFullscreen,
      }

      const result = await this.applyWallpaper(options)
      if (!result.success && result.error) {
        errors.push(`${screenKey}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  async takeScreenshot(
    backgroundPath: string,
    outputPath: string,
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      await hostExecAsync(`linux-wallpaperengine --screenshot "${outputPath}" "${backgroundPath}"`)
      return { success: true, path: outputPath }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to take screenshot',
      }
    }
  }
}

// Export singleton instance
export const wallpaperService = WallpaperService.getInstance()
