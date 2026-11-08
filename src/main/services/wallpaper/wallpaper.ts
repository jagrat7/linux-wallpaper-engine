import * as fs from 'node:fs/promises'
export type { DebugInfo } from './wallpaper.types'
import * as fsSync from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import { displayService } from '../display'
import { settingsService, type AppSettings } from '../settings'
import { storeService } from '../store'
import {
  backendArgPattern,
  hostExecFileAsync,
  hostCommandExists,
  isFlatpak,
} from '../../utils/host'
import { backendSupervisor } from '../../utils/backend-supervisor'
import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import {
  BACKEND_NOT_INSTALLED_ERROR_MESSAGE,
  pickScanManagedFields,
  type ApplyWallpaperOptions,
  type Wallpaper,
  type WallpaperOverrides,
} from '../../../shared/constants/wallpaper'
import { invalidationService } from '../invalidation'
import { compatibilityService } from '../compatibility'
import { playlistService } from '../playlists/playlist'
import {
  expandPath,
  parseWallpaperType,
  parseContentRating,
  detectResolution,
  readProjectSummary,
  parseWindowGeometry,
  resolveTimedCache,
  buildApplyOptions,
  pickRandomWallpaper,
  signalWallpaperProcess,
  listBackendProcesses,
  isScreenBackendRunning,
  BACKEND_PROCESS_PATTERN,
  type TimedCache,
} from './wallpaper.utils'
import { listProperties } from './properties'
import { wallpaperStateManager } from './state-manager/state-manager'
import type { IWallpaperService } from './wallpaper.interface'
import type {
  MutationResult,
  ActiveWallpaperEntry,
  ApplyTarget,
  OverrideMutation,
  ServiceAction,
  DebugInfo,
  RemainingScreen,
} from './wallpaper.types'

class WallpaperService implements IWallpaperService {
  private static instance: WallpaperService | null = null

  private wallpaperCacheEntry: TimedCache<Wallpaper[]> | null = null
  // The library scan in progress, shared by every caller until it settles
  private wallpaperScan: Promise<Wallpaper[]> | null = null
  private overridesStore = storeService.wallpaperOverrides
  private fsWatchers: fsSync.FSWatcher[] = []
  private reapplyTimer: ReturnType<typeof setTimeout> | null = null
  private state = wallpaperStateManager
  private backends = backendSupervisor

  private constructor() {}

  static getInstance(): WallpaperService {
    if (!WallpaperService.instance) {
      WallpaperService.instance = new WallpaperService()
    }
    return WallpaperService.instance
  }

  parseWindowGeometry = parseWindowGeometry

  listProperties = listProperties

  /** Resolve settings and per-call overrides into backend apply options. */
  buildApplyOptions = buildApplyOptions

  // ── Query ──────────────────────────────────────────────────────────────

  /** Installed wallpapers and when each was last applied, for the library grid. */
  async query(): Promise<{
    wallpapers: Wallpaper[]
    appliedHistory: Record<string, number>
  }> {
    const wallpapers = await this.getWallpapers()
    return { wallpapers, appliedHistory: this.state.getAppliedHistory() }
  }

  /** Installed wallpapers from the same cached scan as `query`. */
  catalog(): Promise<Wallpaper[]> {
    return this.getWallpapers()
  }

  /**
   * Wallpapers active on each screen. Never waits on a library scan: titles
   * come from the cached catalog when there is one, otherwise from each active
   * wallpaper's project.json, so the UI shows what's running right after launch.
   */
  async getActive(): Promise<ActiveWallpaperEntry[]> {
    await this.pruneDeadRestoredScreens()
    return this.getActiveWithTitles(this.wallpaperCacheEntry?.value ?? [])
  }

  /** Whether the linux-wallpaperengine backend is on the host PATH. */
  isBackendInstalled(): Promise<boolean> {
    return this.checkBackendInstalled()
  }

  // ── Launch ─────────────────────────────────────────────────────────────

  /**
   * Bring back the wallpapers saved from the last run. Called once from main
   * after this instance holds the single-instance lock, so a second launch
   * never restores on top of the first. Backends a crashed run left behind are
   * killed and respawned rather than left running untracked, so every
   * backend on screen has a handle this instance can stop.
   */
  restore(): Promise<MutationResult> {
    return this.backends.run(async () => {
      if (this.state.getActive().size === 0) return { success: true }
      await this.backends.killMatching(
        [...this.state.getActive().keys()].flatMap(
          (screen) => this.screenSignalPattern(screen) ?? [],
        ),
      )
      return this.reapplyAll()
    })
  }

  /**
   * Kill every backend this instance owns as the app quits. Saved wallpapers
   * are kept so the next launch restores them.
   */
  shutdown(): void {
    this.backends.shutdown(
      [...this.state.getActive().keys()].flatMap(
        (screen) => this.screenSignalPattern(screen) ?? [],
      ),
    )
  }

  // ── Apply ──────────────────────────────────────────────────────────────

  apply(target: ApplyTarget): Promise<MutationResult> {
    return this.backends.run(() => {
      switch (target.kind) {
        case 'wallpaper':
          return this.applyWallpaper(target.options)
        case 'reapply':
          return this.reapplyAll()
      }
      throw new Error('Unsupported wallpaper apply target', { cause: target satisfies never })
    })
  }

  /** Start a playlist's backend on `screens`, replacing whatever they were running. */
  startPlaylist(
    playlistName: string,
    screens: string[],
    stampLastApplied: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    return this.backends.run(() =>
      playlistService.startProcess(
        playlistName,
        screens,
        stampLastApplied,
        (screenKeys, proc, args, options) => this.registerProcess(screenKeys, proc, args, options),
      ),
    )
  }

  // ── Stop ───────────────────────────────────────────────────────────────

  stop(targetScreen?: string | string[]): Promise<MutationResult> {
    return this.backends.run(() => this.stopScreens(targetScreen))
  }

  private async stopScreens(targetScreen?: string | string[]): Promise<MutationResult> {
    const settings = await settingsService.loadSettings()
    const screens = Array.isArray(targetScreen) ? targetScreen : targetScreen ? [targetScreen] : []
    if (screens.length > 0 && !settings.windowMode) {
      const { remaining, released } = this.state.releaseMany(screens)
      // Kill any orphaned processes for this screen
      await this.backends.killMatching(
        screens.map((screen) => backendArgPattern('--screen-root', screen)),
      )
      // Respawn remaining screens that shared the process
      await this.respawnGrouped(remaining)
      invalidationService.emit('wallpaper.stopped')
      return { success: true, screens: released.length > 0 ? released : screens }
    } else {
      const activeScreens = [...this.state.getActive().keys()]
      this.state.reset()
      try {
        await hostExecFileAsync('pkill', ['-9', '-f', BACKEND_PROCESS_PATTERN])
      } catch {
        /* no process found is ok */
      }
      invalidationService.emit('wallpaper.stopped')
      return { success: true, screens: activeScreens }
    }
  }

  /** Freeze active wallpaper processes on the requested screens. */
  pause(screen?: string | string[]): Promise<MutationResult> {
    return this.backends.run(() => this.setPaused(screen, true))
  }

  /** Resume wallpaper processes previously paused by the app. */
  resume(screen?: string | string[]): Promise<MutationResult> {
    return this.backends.run(() => this.setPaused(screen, false))
  }

  /** Apply an installed wallpaper that is not already active when possible. */
  async applyRandom(screen?: string): Promise<MutationResult & { wallpaperTitle?: string }> {
    const wallpapers = await this.getWallpapers()
    if (wallpapers.length === 0) return { success: false, error: 'No wallpapers installed' }

    const activeIds = new Set([...this.state.getActive().values()].map((item) => item.backgroundId))
    const pick = pickRandomWallpaper(wallpapers, activeIds)
    const settings = await settingsService.loadSettings()
    const options = buildApplyOptions(settings, { backgroundId: pick.path, screen })
    const result = await this.backends.run(() => this.applyWallpaper(options))
    if (result.success && result.screens) playlistService.clearActivePlaylist(result.screens)
    return { ...result, wallpaperTitle: pick.title }
  }

  /** Return screen keys with an active wallpaper process. */
  getActiveScreens(): string[] {
    return [...this.state.getActive().keys()]
  }

  /** Return screen keys whose wallpaper process is paused. */
  getPausedScreens(): string[] {
    return this.state.getPausedScreens()
  }

  /**
   * Signal each target's process with SIGSTOP/SIGCONT. Screens sharing a
   * process flip together, so later group members are skipped once their
   * process has been signalled.
   */
  private async setPaused(
    screen: string | string[] | undefined,
    paused: boolean,
  ): Promise<MutationResult> {
    const before = new Set(this.state.getPausedScreens())
    const errors: string[] = []
    for (const target of this.resolveTargetScreens(screen)) {
      if (this.state.isPaused(target) === paused) continue
      const delivered = await signalWallpaperProcess(
        paused ? 'SIGSTOP' : 'SIGCONT',
        this.state.getProcess(target),
        this.screenSignalPattern(target),
      )
      if (delivered) {
        this.state.markPaused([target], paused)
      } else {
        errors.push(
          `${target}: ${paused ? 'process is not running' : 'failed to resume frozen process'}`,
        )
      }
    }

    const after = new Set(this.state.getPausedScreens())
    const changed = paused
      ? [...after].filter((s) => !before.has(s))
      : [...before].filter((s) => !after.has(s))
    if (changed.length > 0) {
      invalidationService.emit(paused ? 'wallpaper.paused' : 'wallpaper.resumed')
    }
    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      screens: changed.length > 0 ? changed : undefined,
    }
  }

  private resolveTargetScreens(screen?: string | string[]): string[] {
    const active = new Set(this.state.getActive().keys())
    if (Array.isArray(screen)) return screen.filter((target) => active.has(target))
    if (screen) return active.has(screen) ? [screen] : []
    return [...active]
  }

  private screenSignalPattern(screen: string): string | null {
    if (screen !== 'default') return backendArgPattern('--screen-root', screen)
    const playlist = playlistService.getActivePlaylistEntries()[screen]
    if (playlist) return backendArgPattern('--playlist', playlist.name)
    const backgroundId = this.state.getActive().get(screen)?.backgroundId
    if (backgroundId) return backendArgPattern('--bg', backgroundId)
    return null
  }

  // ── Overrides ──────────────────────────────────────────────────────────

  async overrides(mutation: OverrideMutation): Promise<WallpaperOverrides | void> {
    const all = this.overridesStore.get('overrides')

    switch (mutation.op) {
      case 'get':
        return all[mutation.wallpaperPath] ?? {}

      case 'save': {
        // Scan-managed fields live in the same record but are owned by the
        // compatibility service and stripped by the tRPC schema — carry them
        // forward so saving user overrides can't erase a wallpaper's scan results.
        all[mutation.wallpaperPath] = {
          ...mutation.overrides,
          ...pickScanManagedFields(all[mutation.wallpaperPath]),
        }
        this.overridesStore.set('overrides', all)
        if (this.state.isActive(mutation.wallpaperPath)) {
          this.debouncedReapply()
        }
        return
      }

      case 'reset': {
        // Reset only clears user overrides; scan results survive like in save
        const scanFields = pickScanManagedFields(all[mutation.wallpaperPath])
        if (Object.keys(scanFields).length > 0) {
          all[mutation.wallpaperPath] = scanFields
        } else {
          delete all[mutation.wallpaperPath]
        }
        this.overridesStore.set('overrides', all)
        if (this.state.isActive(mutation.wallpaperPath)) {
          await this.backends.run(() => this.reapplyAll())
        }
        return
      }
    }
  }

  private stampApplied(backgroundId: string): void {
    this.state.recordApplied(backgroundId)
    invalidationService.emit('wallpaper.getWallpapers')
  }

  // ── Diagnose ───────────────────────────────────────────────────────────

  async diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void> {
    switch (action.kind) {
      case 'getLogs':
        return this.state.getDebugLogs(action.screen)

      case 'clearLogs':
        this.state.clearDebugLogs(action.screen)
        return

      case 'invalidateCache':
        this.invalidateCatalog()
        return

      case 'cleanup':
        this.stopWatchers()
        return
    }
  }

  // ── Private: catalog ───────────────────────────────────────────────────

  private async checkBackendInstalled(): Promise<boolean> {
    return hostCommandExists('linux-wallpaperengine')
  }

  // Callers that arrive during a scan share it. Every UI query at launch
  // otherwise started its own full scan, and they slowed each other down.
  private getWallpapers(): Promise<Wallpaper[]> {
    if (this.wallpaperScan) return this.wallpaperScan
    const scan = resolveTimedCache(this.wallpaperCacheEntry, () => this.scanWallpapers())
      .then((entry) => {
        // A scan invalidated while it ran still answers its callers, but isn't cached
        if (this.wallpaperScan === scan) this.wallpaperCacheEntry = entry
        return entry.value
      })
      .finally(() => {
        if (this.wallpaperScan === scan) this.wallpaperScan = null
      })
    this.wallpaperScan = scan
    return scan
  }

  private invalidateCatalog(): void {
    this.wallpaperCacheEntry = null
    this.wallpaperScan = null
  }

  private async scanWallpapers(): Promise<Wallpaper[]> {
    const workshopDirs: Set<string> = new Set()
    const wallpapers: Wallpaper[] = []
    const seen: Set<string> = new Set()

    const steamLibraryPaths = await playlistService.resolveSteamLibraryPaths()

    for (const expanded of steamLibraryPaths) {
      const workshopPath = path.join(
        expanded,
        'steamapps/workshop/content',
        String(WALLPAPER_ENGINE_APP_ID),
      )
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch {
        /* path doesn't exist */
      }

      const presetsPath = path.join(expanded, 'steamapps/common/wallpaper_engine/assets/presets')
      try {
        await fs.access(presetsPath)
        workshopDirs.add(presetsPath)
      } catch {
        /* path doesn't exist */
      }
    }

    const snapPaths = await glob(expandPath('~/snap/steam/*/.local/share/Steam'))
    for (const snapPath of snapPaths) {
      const workshopPath = path.join(
        snapPath,
        'steamapps/workshop/content',
        String(WALLPAPER_ENGINE_APP_ID),
      )
      try {
        await fs.access(workshopPath)
        workshopDirs.add(workshopPath)
      } catch {
        /* skip */
      }
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
              const { stdout } = await hostExecFileAsync('du', ['-sb', wallpaperPath])
              fileSize = parseInt(stdout.split('\t')[0], 10) || 0
            } catch {
              /* ignore */
            }

            let dateAdded = 0
            try {
              const stat = await fs.stat(wallpaperPath)
              dateAdded = stat.mtimeMs
            } catch {
              /* ignore */
            }

            const type = parseWallpaperType(project.type)

            let thumbnail = ''
            if (project.preview) {
              thumbnail = path.join(wallpaperPath, project.preview)
            }

            const resolution = await detectResolution(wallpaperPath)

            wallpapers.push({
              id: itemId,
              workshopId: itemId,
              ageRating: parseContentRating(project.contentrating),
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
            /* skip wallpapers without valid project.json */
          }
        }
      } catch {
        /* skip unreadable directories */
      }
    }

    wallpapers.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
    this.startWatchers([...workshopDirs])

    return wallpapers
  }

  // ── Private: active wallpaper enrichment ───────────────────────────────

  private async getActiveWithTitles(allWallpapers: Wallpaper[]): Promise<ActiveWallpaperEntry[]> {
    const result: ActiveWallpaperEntry[] = []

    for (const [screen, wallpaper] of this.state.getActive().entries()) {
      const cached = allWallpapers.find((w) => w.path === wallpaper.backgroundId)
      const project = cached ? null : await readProjectSummary(wallpaper.backgroundId)
      const title =
        cached?.title ??
        project?.title ??
        wallpaper.backgroundId.split('/').filter(Boolean).pop() ??
        'Unknown'
      const thumbnail = cached?.thumbnail ?? project?.thumbnail ?? ''

      result.push({ screen, wallpaper, title, thumbnail, paused: this.state.isPaused(screen) })
    }

    return result
  }

  /**
   * Drop restored screens (no process handle, so no exit listener) whose
   * backend process has since died, so they stop showing as active.
   */
  private async pruneDeadRestoredScreens(): Promise<void> {
    const restored = [...this.state.getActive().keys()].filter(
      (screen) => !this.state.getProcess(screen),
    )
    if (restored.length === 0) return

    const processes = await listBackendProcesses()
    const dead = restored.filter((screen) => !isScreenBackendRunning(screen, processes))
    if (dead.length === 0) return

    this.state.releaseMany(dead)
    playlistService.clearActivePlaylist(dead)
    invalidationService.emit('wallpaper.stopped')
  }

  // ── Private: process spawning ──────────────────────────────────────────

  private async applyWallpaper(options: ApplyWallpaperOptions): Promise<MutationResult> {
    const backendInstalled = await this.checkBackendInstalled()
    if (!backendInstalled) {
      return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
    }

    if (options.windowed) {
      const result = await this.spawnWindowed(options)
      if (result.success) {
        invalidationService.emit('wallpaper.applied')
        this.stampApplied(options.backgroundId)
      }
      return result
    }

    let targetScreens: string[]
    if (options.screen) {
      targetScreens = [options.screen]
    } else {
      try {
        const displays = await displayService.detectDisplays()
        targetScreens = displays.map((d) => d.name)
      } catch {
        targetScreens = ['eDP-1']
      }
    }

    // Release the target screens in one go so screens sharing their process
    // are respawned once, without first respawning a target with the old wallpaper
    const { remaining } = this.state.releaseMany(targetScreens)
    await this.respawnGrouped(remaining)

    const result = await this.spawnForScreens(targetScreens, options)
    if (result.success) {
      invalidationService.emit('wallpaper.applied')
      this.stampApplied(options.backgroundId)
    }
    return result
  }

  private async spawnWindowed(options: ApplyWallpaperOptions): Promise<MutationResult> {
    let args = ['--bg', options.backgroundId, ...(await this.buildArgs(options))]
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

      await new Promise((resolve) => setTimeout(resolve, 100))

      const proc = this.spawn(args, options.backgroundId)
      this.state.register([screenKey], proc, options)

      if (await this.exitedEarly(proc)) {
        return { success: false }
      }
      return { success: true, screens: [screenKey] }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply wallpaper',
      }
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
    args.push(...(await this.buildArgs(options)))

    try {
      // Kill orphaned processes
      await this.backends.killMatching(
        screens.map((screen) => backendArgPattern('--screen-root', screen)),
      )

      await new Promise((resolve) => setTimeout(resolve, 100))

      const proc = this.spawn(args, options.backgroundId)
      this.state.register(screens, proc, options)
      this.captureDebugLogs(proc, screens[0], args)

      if (await this.exitedEarly(proc)) {
        return { success: false }
      }
      return { success: true, screens }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply wallpaper',
      }
    }
  }

  private spawn(args: string[], backgroundId: string) {
    const debugMode = settingsService.getSetting('debugMode')
    const proc = this.backends.spawn(args, {
      stdio: debugMode ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'],
      onExit: () => this.handleUnexpectedExit(proc),
    })
    compatibilityService.monitorProcess(proc, backgroundId)
    return proc
  }

  // A backend exited without being stopped: drop the screens it still drove
  private handleUnexpectedExit(proc: import('node:child_process').ChildProcess): void {
    const { screens } = this.state.cleanupExitedProcess(proc)
    if (screens.length > 0) {
      playlistService.clearActivePlaylist(screens)
      invalidationService.emit('wallpaper.stopped')
    }
  }

  // Wait briefly to detect if the spawned process exits immediately (failed apply).
  private async exitedEarly(
    proc: import('node:child_process').ChildProcess,
    graceMs = 100,
  ): Promise<boolean> {
    if (proc.exitCode !== null || proc.signalCode !== null) return true
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        proc.off('exit', onExit)
        resolve(false)
      }, graceMs)
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer)
        console.warn(`[wallpaper] process exited early (code=${code}, signal=${signal ?? 'none'})`)
        resolve(true)
      }
      proc.once('exit', onExit)
    })
  }

  private registerProcess(
    screens: string[],
    proc: import('node:child_process').ChildProcess,
    args: string[],
    options: ApplyWallpaperOptions,
  ): void {
    for (const screen of screens) {
      const existing = this.state.getProcess(screen)
      if (existing) {
        this.state.release(screen)
      }
    }
    compatibilityService.monitorProcess(proc, options.backgroundId)
    proc.once('exit', () => {
      if (!this.backends.isShuttingDown) this.handleUnexpectedExit(proc)
    })
    this.state.register(screens, proc, options)
    this.captureDebugLogs(proc, screens[0] ?? 'default', args)
    invalidationService.emit('wallpaper.applied')
  }

  // ── Private: reapply ───────────────────────────────────────────────────

  private async reapplyAll(): Promise<MutationResult> {
    const errors: string[] = []
    const pausedScreens = this.state.getPausedScreens()
    const settings = await settingsService.loadSettings()
    const grouped = new Map<string, { screens: string[]; options: ApplyWallpaperOptions }>()

    // Screens running a playlist restart their playlist process (which picks
    // up current global settings) instead of being flattened to a single
    // wallpaper.
    const active = [...this.state.getActive().entries()].map(([screen, options]) => ({
      screen,
      options,
    }))
    const { playlistScreens, wallpaperRemaining } = this.partitionByPlaylist(active)
    errors.push(...(await this.restartPlaylists(playlistScreens)))

    for (const { screen: screenKey, options: baseOptions } of wallpaperRemaining) {
      const options: ApplyWallpaperOptions = {
        ...baseOptions,
        screen: screenKey !== 'default' ? screenKey : baseOptions.screen,
        fps: settings.fps,
        volume: settings.volume,
        silent: settings.silent,
        noAutomute: settings.noAutomute,
        noAudioProcessing: !settings.audioProcessing,
        scaling:
          baseOptions.scaling && baseOptions.scaling !== 'default'
            ? baseOptions.scaling
            : settings.defaultScaling,
        disableMouse: settings.disableMouse,
        disableParallax: settings.disableParallax,
        disableParticles: settings.disableParticles,
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
        ? await this.spawnWindowed({
            ...options,
            screen: undefined,
            windowed: parseWindowGeometry(settings.windowGeometry),
          })
        : await this.spawnForScreens(screens, options)
      if (!result.success && result.error) {
        errors.push(`${screens.join(',')}: ${result.error}`)
      }
    }

    // Respawned processes start running; keep previously paused screens frozen
    const repause = await this.setPaused(pausedScreens, true)
    if (repause.error) errors.push(repause.error)

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  }

  /** Respawn screens left over from a released shared process, keeping paused ones frozen. */
  private async respawnGrouped(remaining: RemainingScreen[]): Promise<void> {
    if (remaining.length === 0) return
    await this.respawnScreens(remaining)
    const paused = remaining.filter((entry) => entry.paused).map((entry) => entry.screen)
    await this.setPaused(paused, true)
  }

  private async respawnScreens(remaining: RemainingScreen[]): Promise<void> {
    const settings = await settingsService.loadSettings()

    // Screens that were part of a playlist restart their playlist process —
    // their stored options only hold the first item, not the playlist or the
    // global audio settings, so respawning them as a plain wallpaper would
    // drop both.
    const { playlistScreens, wallpaperRemaining } = this.partitionByPlaylist(remaining)
    await this.restartPlaylists(playlistScreens)
    if (wallpaperRemaining.length === 0) return

    if (settings.windowMode) {
      const first = wallpaperRemaining[0]
      await this.spawnWindowed({
        ...first.options,
        screen: undefined,
        windowed: parseWindowGeometry(settings.windowGeometry),
      })
      return
    }

    const grouped = new Map<string, { screens: string[]; options: ApplyWallpaperOptions }>()
    for (const { screen, options } of wallpaperRemaining) {
      const key = options.backgroundId
      const existing = grouped.get(key)
      if (existing) {
        existing.screens.push(screen)
      } else {
        grouped.set(key, {
          screens: [screen],
          options: this.withSettingsFallback(options, settings),
        })
      }
    }

    for (const { screens, options } of grouped.values()) {
      await this.spawnForScreens(screens, options)
    }
  }

  // Split screens between those owned by an active playlist and the rest
  private partitionByPlaylist<T extends { screen: string }>(
    entries: T[],
  ): {
    playlistScreens: Map<string, string[]>
    wallpaperRemaining: T[]
  } {
    const playlistEntries = playlistService.getActivePlaylistEntries()
    const playlistScreens = new Map<string, string[]>()
    const wallpaperRemaining: T[] = []

    for (const entry of entries) {
      const playlistEntry = playlistEntries[entry.screen]
      if (playlistEntry) {
        const screens = playlistScreens.get(playlistEntry.name)
        if (screens) {
          screens.push(entry.screen)
        } else {
          playlistScreens.set(playlistEntry.name, [entry.screen])
        }
      } else {
        wallpaperRemaining.push(entry)
      }
    }

    return { playlistScreens, wallpaperRemaining }
  }

  private async restartPlaylists(playlistScreens: Map<string, string[]>): Promise<string[]> {
    const errors: string[] = []
    for (const [name, screens] of playlistScreens) {
      const result = await playlistService.startProcess(
        name,
        screens,
        false,
        (screenKeys, proc, args, options) => this.registerProcess(screenKeys, proc, args, options),
      )
      if (!result.success) {
        // Playlist is gone (e.g. deleted) — drop the stale active entries
        playlistService.clearActivePlaylist(screens)
        if (result.error) errors.push(`${screens.join(',')}: ${result.error}`)
      }
    }
    return errors
  }

  // Fill gaps in stored apply options from the current global settings, so a
  // respawn from sparse state (e.g. persisted from a playlist register) still
  // honors silent/volume and the other engine flags.
  private withSettingsFallback(
    options: ApplyWallpaperOptions,
    settings: AppSettings,
  ): ApplyWallpaperOptions {
    return {
      ...options,
      fps: options.fps ?? settings.fps,
      volume: options.volume ?? settings.volume,
      silent: options.silent ?? settings.silent,
      noAutomute: options.noAutomute ?? settings.noAutomute,
      noAudioProcessing: options.noAudioProcessing ?? !settings.audioProcessing,
      scaling:
        options.scaling && options.scaling !== 'default'
          ? options.scaling
          : settings.defaultScaling,
      disableMouse: options.disableMouse ?? settings.disableMouse,
      disableParallax: options.disableParallax ?? settings.disableParallax,
      disableParticles: options.disableParticles ?? settings.disableParticles,
      noFullscreenPause: options.noFullscreenPause ?? !settings.pauseOnFullscreen,
    }
  }

  private debouncedReapply(): void {
    if (this.reapplyTimer) clearTimeout(this.reapplyTimer)
    this.reapplyTimer = setTimeout(() => {
      void this.backends.run(() => this.reapplyAll())
    }, 500)
  }

  // ── Private: CLI args builder ──────────────────────────────────────────

  private async buildArgs(options: ApplyWallpaperOptions): Promise<string[]> {
    const args: string[] = []
    const all = this.overridesStore.get('overrides')
    const overrides = all[options.backgroundId] ?? {}
    const volume = overrides.volume ?? options.volume
    const noAudioProcessing =
      overrides.audioProcessing !== undefined
        ? !overrides.audioProcessing
        : options.noAudioProcessing
    const disableMouse = overrides.disableMouse ?? options.disableMouse
    const disableParallax = overrides.disableParallax ?? options.disableParallax
    const disableParticles = overrides.disableParticles ?? options.disableParticles
    const scaling = overrides.scaling ?? options.scaling
    const customProperties = overrides.customProperties ?? {}
    const assetsDir =
      settingsService.getSetting('assetsDir') ??
      (await playlistService.resolveWallpaperEngineAssetsDir())

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
    if (disableParticles) args.push('--disable-particles')
    if (options.noFullscreenPause) args.push('--no-fullscreen-pause')
    if (scaling && scaling !== 'default') args.push('--scaling', scaling)
    if (assetsDir) args.push('--assets-dir', assetsDir)
    for (const [name, value] of Object.entries(customProperties)) {
      args.push('--set-property', `${name}=${value}`)
    }

    return args
  }

  // ── Private: debug log capture ─────────────────────────────────────────

  private captureDebugLogs(
    proc: import('node:child_process').ChildProcess,
    debugKey: string,
    args: string[],
  ): void {
    const debugMode = settingsService.getSetting('debugMode')
    if (!debugMode) return

    const commandStr = isFlatpak()
      ? `flatpak-spawn --host linux-wallpaperengine ${args.join(' ')}`
      : `linux-wallpaperengine ${args.join(' ')}`

    const logs: string[] = []
    this.state.setDebugLogs(debugKey, commandStr, logs)

    const appendLog = (stream: string, chunk: Buffer) => {
      const lines = chunk
        .toString()
        .split('\n')
        .filter((l) => l.trim())
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

  // ── Private: file watchers ─────────────────────────────────────────────

  private startWatchers(dirs: string[]): void {
    this.stopWatchers()
    let debounce: ReturnType<typeof setTimeout>
    for (const dir of dirs) {
      try {
        const watcher = fsSync.watch(dir, { recursive: false }, () => {
          clearTimeout(debounce)
          debounce = setTimeout(() => {
            this.invalidateCatalog()
            invalidationService.emit('wallpaper.getWallpapers')
          }, 500)
        })
        watcher.on('error', () => watcher.close())
        this.fsWatchers.push(watcher)
      } catch {
        /* directory may have disappeared */
      }
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
