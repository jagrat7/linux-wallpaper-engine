import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import { displayService } from '../display'
import { settingsService } from '../settings'
import { storeService } from '../store'
import { hostSpawn, hostExecAsync, isFlatpak } from '../../utils/host'
import { CACHE_TTL, STEAM_PATHS, WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import type { ApplyWallpaperOptions, Wallpaper, WallpaperOverrides } from '../../../shared/constants/wallpaper'
import { invalidationService } from '../invalidation'
import { compatibilityService } from '../compatibility'
import { expandPath, parseWallpaperType, detectResolution, resolveThumbnail } from './wallpaper.utils'
import { wallpaperStateManager } from './state-manager/state-manager'
import type { IWallpaperService } from './wallpaper.interface'
import type { MutationResult, ActiveWallpaperEntry, ApplyTarget, OverrideMutation, ServiceAction, DebugInfo } from './wallpaper.types'

class WallpaperService implements IWallpaperService {
  private static instance: WallpaperService | null = null

  private wallpaperCache: Wallpaper[] | null = null
  private cacheTimestamp: number | null = null
  private overridesStore = storeService.wallpaperOverrides
  private fsWatchers: fsSync.FSWatcher[] = []
  private reapplyTimer: ReturnType<typeof setTimeout> | null = null
  private state = wallpaperStateManager

  private constructor() {
    this.syncAndReapply()
  }

  static getInstance(): WallpaperService {
    if (!WallpaperService.instance) {
      WallpaperService.instance = new WallpaperService()
    }
    return WallpaperService.instance
  }

  // ── Query ──────────────────────────────────────────────────────────────

  async query(): Promise<{
    wallpapers: Wallpaper[]
    backendInstalled: boolean
    active: ActiveWallpaperEntry[]
  }> {
    const [wallpapers, backendInstalled] = await Promise.all([
      this.getWallpapers(),
      this.checkBackendInstalled(),
    ])
    const active = await this.getActiveWithTitles(wallpapers)
    return { wallpapers, backendInstalled, active }
  }

  // ── Apply ──────────────────────────────────────────────────────────────

  async apply(target: ApplyTarget): Promise<MutationResult> {
    switch (target.kind) {
      case 'wallpaper':
        return this.applyWallpaper(target.options)
      case 'register':
        this.registerProcess(target.screen, target.proc, target.args, target.options)
        return { success: true }
      case 'reapply':
        return this.reapplyAll()
    }
  }

  // ── Stop ───────────────────────────────────────────────────────────────

  async stop(screen?: string): Promise<{ success: boolean }> {
    const settings = await settingsService.loadSettings()
    if (screen && !settings.windowMode) {
      const { remaining } = this.state.release(screen)
      // Kill any orphaned processes for this screen
      try {
        await hostExecAsync(`pkill -9 -f "linux-wallpaperengine.*--screen-root.*${screen}"`)
      } catch { /* no process found is ok */ }
      // Respawn remaining screens that shared the process
      await this.respawnGrouped(remaining)
      invalidationService.emit('wallpaper.stopped')
    } else {
      this.state.reset()
      try {
        await hostExecAsync('pkill -9 -f linux-wallpaperengine')
      } catch { /* no process found is ok */ }
      invalidationService.emit('wallpaper.stopped')
    }
    return { success: true }
  }

  // ── Overrides ──────────────────────────────────────────────────────────

  async overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void> {
    const all = this.overridesStore.get('overrides')

    switch (mutation.op) {
      case 'get':
        return all[mutation.wallpaperPath] ?? {}

      case 'save':
        all[mutation.wallpaperPath] = mutation.overrides
        this.overridesStore.set('overrides', all)
        if (this.state.isActive(mutation.wallpaperPath)) {
          this.debouncedReapply()
        }
        return

      case 'reset':
        delete all[mutation.wallpaperPath]
        this.overridesStore.set('overrides', all)
        if (this.state.isActive(mutation.wallpaperPath)) {
          await this.reapplyAll()
        }
        return
    }
  }

  // ── Diagnose ───────────────────────────────────────────────────────────

  async diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void> {
    switch (action.kind) {
      case 'getLogs':
        return this.state.getDebugLogs(action.screen)

      case 'clearLogs':
        this.state.clearDebugLogs(action.screen)
        return

      case 'screenshot':
        return this.takeScreenshot(action.backgroundPath, action.outputPath)

      case 'invalidateCache':
        this.wallpaperCache = null
        this.cacheTimestamp = null
        return

      case 'cleanup':
        this.stopWatchers()
        return
    }
  }

  // ── Private: catalog ───────────────────────────────────────────────────

  private async checkBackendInstalled(): Promise<boolean> {
    try {
      await hostExecAsync('which linux-wallpaperengine')
      return true
    } catch {
      return false
    }
  }

  private async getWallpapers(): Promise<Wallpaper[]> {
    const now = Date.now()
    const cacheExpired = !this.cacheTimestamp || (now - this.cacheTimestamp) > CACHE_TTL

    if (!this.wallpaperCache || cacheExpired) {
      this.wallpaperCache = await this.scanWallpapers()
      this.cacheTimestamp = now
    }

    return this.wallpaperCache
  }

  private async scanWallpapers(): Promise<Wallpaper[]> {
    const workshopDirs: Set<string> = new Set()
    const wallpapers: Wallpaper[] = []
    const seen: Set<string> = new Set()

    for (const basePath of STEAM_PATHS) {
      const expanded = expandPath(basePath)

      const workshopPath = path.join(expanded, 'steamapps/workshop/content', String(WALLPAPER_ENGINE_APP_ID))
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch { /* path doesn't exist */ }

      const presetsPath = path.join(expanded, 'steamapps/common/wallpaper_engine/assets/presets')
      try {
        await fs.access(presetsPath)
        workshopDirs.add(presetsPath)
      } catch { /* path doesn't exist */ }
    }

    const snapPaths = await glob(expandPath('~/snap/steam/*/.local/share/Steam'))
    for (const snapPath of snapPaths) {
      const workshopPath = path.join(snapPath, 'steamapps/workshop/content', String(WALLPAPER_ENGINE_APP_ID))
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch { /* skip */ }
    }

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

            let fileSize = 0
            try {
              const { stdout } = await hostExecAsync(`du -sb "${wallpaperPath}"`)
              fileSize = parseInt(stdout.split('\t')[0], 10) || 0
            } catch { /* ignore */ }

            let dateAdded = 0
            try {
              const stat = await fs.stat(wallpaperPath)
              dateAdded = stat.mtimeMs
            } catch { /* ignore */ }

            const type = parseWallpaperType(project.type)

            let thumbnail = ''
            if (project.preview) {
              thumbnail = path.join(wallpaperPath, project.preview)
            }

            const resolution = await detectResolution(wallpaperPath)

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
          } catch { /* skip wallpapers without valid project.json */ }
        }
      } catch { /* skip unreadable directories */ }
    }

    wallpapers.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
    this.startWatchers([...workshopDirs])

    return wallpapers
  }

  // ── Private: active wallpaper enrichment ───────────────────────────────

  private async getActiveWithTitles(allWallpapers: Wallpaper[]): Promise<ActiveWallpaperEntry[]> {
    const result: ActiveWallpaperEntry[] = []

    for (const [screen, wallpaper] of this.state.getActive().entries()) {
      if (!this.state.getProcess(screen)) continue

      const cached = allWallpapers.find(w => w.path === wallpaper.backgroundId)
      const title = cached?.title ?? wallpaper.backgroundId.split('/').filter(Boolean).pop() ?? 'Unknown'
      const thumbnail = cached?.thumbnail ?? await resolveThumbnail(wallpaper.backgroundId)

      result.push({ screen, wallpaper, title, thumbnail })
    }

    return result
  }

  // ── Private: process spawning ──────────────────────────────────────────

  private async applyWallpaper(options: ApplyWallpaperOptions): Promise<MutationResult> {
    if (options.windowed) {
      const result = await this.spawnWindowed(options)
      if (result.success) {
        invalidationService.emit('wallpaper.applied')
      }
      return result
    }

    let targetScreens: string[]
    if (options.screen) {
      targetScreens = [options.screen]
    } else {
      try {
        const displays = await displayService.detectDisplays()
        targetScreens = displays.map(d => d.name)
      } catch {
        targetScreens = ['eDP-1']
      }
    }

    // Release screens from any shared processes, respawn remaining
    for (const screen of targetScreens) {
      const { remaining } = this.state.release(screen)
      await this.respawnGrouped(remaining)
    }

    const result = await this.spawnForScreens(targetScreens, options)
    if (result.success) {
      invalidationService.emit('wallpaper.applied')
    }
    return result
  }

  private async spawnWindowed(options: ApplyWallpaperOptions): Promise<MutationResult> {
    let args = ['--bg', options.backgroundId, ...this.buildArgs(options)]
    // 'emit-flag' means run in app-level window mode with no backend geometry flag.
    if (options.windowed !== 'emit-flag' && options.windowed) {
      const { x, y, width, height } = options.windowed
      args = ['--window', `${x}x${y}x${width}x${height}`, ...args]
    }
    try {
      const screenKey = 'default'
      const existing = this.state.getProcess(screenKey)
      if (existing) {
        this.state.release(screenKey)
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const proc = this.spawn(args, options.backgroundId)
      this.state.register([screenKey], proc, options)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to apply wallpaper' }
    }
  }

  private async spawnForScreens(
    screens: string[],
    options: ApplyWallpaperOptions,
  ): Promise<MutationResult> {
    const args: string[] = []
    for (const screen of screens) {
      args.push('--screen-root', screen)
    }
    args.push('--bg', options.backgroundId)
    args.push(...this.buildArgs(options))

    try {
      // Kill orphaned processes
      for (const screen of screens) {
        try {
          await hostExecAsync(`pkill -9 -f "linux-wallpaperengine.*--screen-root.*${screen}"`)
        } catch { /* no process found is ok */ }
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const proc = this.spawn(args, options.backgroundId)
      this.state.register(screens, proc, options)
      this.captureDebugLogs(proc, screens[0], args)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to apply wallpaper' }
    }
  }

  private spawn(args: string[], backgroundId: string) {
    const debugMode = settingsService.getSetting('debugMode')
    const proc = hostSpawn('linux-wallpaperengine', args, {
      detached: true,
      stdio: debugMode
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'ignore', 'pipe'],
    })
    proc.unref()
    compatibilityService.monitorProcess(proc, backgroundId)
    return proc
  }

  private registerProcess(screen: string, proc: import('node:child_process').ChildProcess, args: string[], options: ApplyWallpaperOptions): void {
    const screenKey = screen ?? 'default'
    const existing = this.state.getProcess(screenKey)
    if (existing) {
      this.state.release(screenKey)
    }
    proc.unref()
    compatibilityService.monitorProcess(proc, options.backgroundId)
    this.state.register([screenKey], proc, options)
    this.captureDebugLogs(proc, screenKey, args)
  }

  // ── Private: reapply ───────────────────────────────────────────────────

  private async reapplyAll(): Promise<MutationResult> {
    const errors: string[] = []
    const settings = await settingsService.loadSettings()
    const grouped = new Map<string, { screens: string[], options: ApplyWallpaperOptions }>()

    for (const [screenKey, baseOptions] of this.state.getActive().entries()) {
      const options: ApplyWallpaperOptions = {
        ...baseOptions,
        screen: screenKey !== 'default' ? screenKey : baseOptions.screen,
        fps: settings.fps,
        volume: settings.volume,
        silent: settings.silent,
        noAutomute: settings.noAutomute,
        noAudioProcessing: !settings.audioProcessing,
        scaling: baseOptions.scaling && baseOptions.scaling !== 'default' ? baseOptions.scaling : settings.defaultScaling,
        disableMouse: settings.disableMouse,
        disableParallax: settings.disableParallax,
        noFullscreenPause: !settings.pauseOnFullscreen,
      }

      const key = options.backgroundId
      const existing = grouped.get(key)
      if (existing) {
        existing.screens.push(screenKey)
      } else {
        grouped.set(key, { screens: [screenKey], options })
      }
    }

    const windowMode = settings.windowMode
    for (const { screens, options } of grouped.values()) {
      const result = windowMode
        ? await this.spawnWindowed({ ...options, screen: undefined, windowed: 'emit-flag' })
        : await this.spawnForScreens(screens, options)
      if (!result.success && result.error) {
        errors.push(`${screens.join(',')}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  }

  private async respawnGrouped(remaining: Array<{ screen: string, options: ApplyWallpaperOptions }>): Promise<void> {
    if (remaining.length === 0) return

    const settings = await settingsService.loadSettings()
    if (settings.windowMode) {
      const first = remaining[0]
      await this.spawnWindowed({ ...first.options, screen: undefined, windowed: 'emit-flag' })
      return
    }

    const grouped = new Map<string, { screens: string[], options: ApplyWallpaperOptions }>()
    for (const { screen, options } of remaining) {
      const key = options.backgroundId
      const existing = grouped.get(key)
      if (existing) {
        existing.screens.push(screen)
      } else {
        grouped.set(key, { screens: [screen], options })
      }
    }

    for (const { screens, options } of grouped.values()) {
      await this.spawnForScreens(screens, options)
    }
  }

  private async syncAndReapply(): Promise<void> {
    if (this.state.getActive().size === 0) return

    try {
      const settings = await settingsService.loadSettings()
      const { stdout } = await hostExecAsync('pgrep -a linux-wallpaperengine').catch(() => ({ stdout: '' }))
      const processOutput = stdout.trim()

      if (settings.windowMode) {
        if (processOutput.length === 0) {
          await this.reapplyAll()
        }
        return
      }

      for (const [screen] of this.state.getActive().entries()) {
        const isRunning = screen === 'default'
          ? processOutput.length > 0 && !processOutput.includes('--screen-root')
          : processOutput.includes(`--screen-root ${screen}`)

        if (!isRunning) {
          await this.reapplyAll()
          return
        }
      }
    } catch {
      await this.reapplyAll()
    }
  }

  private debouncedReapply(): void {
    if (this.reapplyTimer) clearTimeout(this.reapplyTimer)
    this.reapplyTimer = setTimeout(() => {
      this.reapplyAll()
    }, 500)
  }

  // ── Private: CLI args builder ──────────────────────────────────────────

  private buildArgs(options: ApplyWallpaperOptions): string[] {
    const args: string[] = []
    const all = this.overridesStore.get('overrides')
    const overrides = all[options.backgroundId] ?? {}
    const volume = overrides.volume ?? options.volume
    const noAudioProcessing = overrides.audioProcessing !== undefined
      ? !overrides.audioProcessing
      : options.noAudioProcessing
    const disableMouse = overrides.disableMouse ?? options.disableMouse
    const disableParallax = overrides.disableParallax ?? options.disableParallax
    const scaling = overrides.scaling ?? options.scaling

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

    return args
  }

  // ── Private: debug log capture ─────────────────────────────────────────

  private captureDebugLogs(proc: import('node:child_process').ChildProcess, debugKey: string, args: string[]): void {
    const debugMode = settingsService.getSetting('debugMode')
    if (!debugMode) return

    const commandStr = isFlatpak()
      ? `flatpak-spawn --host linux-wallpaperengine ${args.join(' ')}`
      : `linux-wallpaperengine ${args.join(' ')}`

    const logs: string[] = []
    this.state.setDebugLogs(debugKey, commandStr, logs)

    const appendLog = (stream: string, chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(l => l.trim())
      for (const line of lines) {
        logs.push(`[${stream}] ${line}`)
      }
    }

    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => appendLog('stdout', chunk))
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => appendLog('stderr', chunk))
    }

    proc.on('exit', (code, signal) => {
      logs.push(`[process] Exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`)
    })
  }

  // ── Private: screenshot ────────────────────────────────────────────────

  private async takeScreenshot(backgroundPath: string, outputPath: string): Promise<MutationResult & { path?: string }> {
    try {
      await hostExecAsync(`linux-wallpaperengine --screenshot "${outputPath}" "${backgroundPath}"`)
      return { success: true, path: outputPath }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to take screenshot' }
    }
  }

  // ── Private: file watchers ─────────────────────────────────────────────

  private startWatchers(dirs: string[]): void {
    this.stopWatchers()
    let debounce: ReturnType<typeof setTimeout>
    for (const dir of dirs) {
      try {
        const watcher = fsSync.watch(dir, { recursive: false }, () => {
          clearTimeout(debounce)
          debounce = setTimeout(() => {
            this.wallpaperCache = null
            this.cacheTimestamp = null
            invalidationService.emit('wallpaper.getWallpapers')
          }, 500)
        })
        watcher.on('error', () => watcher.close())
        this.fsWatchers.push(watcher)
      } catch { /* directory may have disappeared */ }
    }
  }

  private stopWatchers(): void {
    for (const watcher of this.fsWatchers) {
      watcher.close()
    }
    this.fsWatchers = []
  }
}

export const wallpaperService = WallpaperService.getInstance()
