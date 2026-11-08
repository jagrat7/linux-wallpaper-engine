import type { ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
export type { DebugInfo } from './wallpaper.types'
import * as fsSync from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import { displayService } from '../display'
import { settingsService, type AppSettings } from '../settings'
import { storeService } from '../store'
import { hostExecFileAsync, hostCommandExists, isFlatpak } from '../../utils/host'
import { supervisorService, type RemainingScreen } from '../supervisor/supervisor'
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
  type TimedCache,
} from './wallpaper.utils'
import type { IWallpaperService } from './wallpaper.interface'
import type {
  MutationResult,
  ActiveWallpaperEntry,
  ApplyResult,
  ApplyTarget,
  OverrideMutation,
  ServiceAction,
  DebugInfo,
} from './wallpaper.types'

class WallpaperService implements IWallpaperService {
  private static instance: WallpaperService | null = null

  private wallpaperCacheEntry: TimedCache<Wallpaper[]> | null = null
  // The library scan in progress, shared by every caller until it settles
  private wallpaperScan: Promise<Wallpaper[]> | null = null
  private overridesStore = storeService.wallpaperOverrides
  private fsWatchers: fsSync.FSWatcher[] = []
  private reapplyTimer: ReturnType<typeof setTimeout> | null = null
  private supervisor = supervisorService
  private activeStore = storeService.activeWallpapers
  // Command and output of each screen's last backend, captured in debug mode
  private debugLogs = new Map<string, DebugInfo>()

  private constructor() {}

  static getInstance(): WallpaperService {
    if (!WallpaperService.instance) {
      WallpaperService.instance = new WallpaperService()
    }
    return WallpaperService.instance
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async catalog(): Promise<{ wallpapers: Wallpaper[]; appliedHistory: Record<string, number> }> {
    return { wallpapers: await this.getWallpapers(), appliedHistory: this.getAppliedHistory() }
  }

  async getActive(): Promise<ActiveWallpaperEntry[]> {
    // While restore or another task is spawning, a screen without a handle is
    // about to get one, so only prune between tasks, holding the queue meanwhile
    if (this.supervisor.idle) {
      this.handleLostScreens(await this.supervisor.run(() => this.supervisor.prune()))
    }
    return this.getActiveWithTitles(this.wallpaperCacheEntry?.value ?? [])
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  apply(target: ApplyTarget): Promise<ApplyResult> {
    switch (target.kind) {
      case 'wallpaper':
        return this.supervisor.run(async () =>
          this.applyWallpaper(
            buildApplyOptions(await settingsService.loadSettings(), target.options),
          ),
        )
      case 'random':
        return this.applyRandom(target.screen)
      case 'playlist':
        return this.supervisor.run(() =>
          this.startPlaylist(target.name, target.screens, target.stampLastApplied),
        )
      case 'reapply':
        return this.supervisor.run(() => this.reapplyAll())
      case 'restore':
        return this.supervisor.run(() => this.restore())
    }
    throw new Error('Unsupported wallpaper apply target', { cause: target satisfies never })
  }

  stop(targetScreen?: string | string[]): Promise<MutationResult> {
    return this.supervisor.run(() => this.stopScreens(targetScreen))
  }

  setPaused(paused: boolean, screen?: string | string[]): Promise<MutationResult> {
    return this.supervisor.run(() => this.pauseScreens(screen, paused))
  }

  // ── Private: apply kinds ───────────────────────────────────────────────

  // Bring back the wallpapers saved from the last run. Main calls this once,
  // after this instance holds the single-instance lock, so a second launch
  // never restores on top of the first. Backends a crashed run left behind are
  // killed and respawned rather than left running untracked
  private async restore(): Promise<MutationResult> {
    if (this.supervisor.screens().size === 0) return { success: true }
    await this.supervisor.stop({ keep: true })
    return this.reapplyAll()
  }

  // Start a playlist's backend on `screens`, replacing whatever they were running
  private async startPlaylist(
    playlistName: string,
    screens: string[],
    stampLastApplied: boolean,
  ): Promise<MutationResult> {
    let started: string[] = []
    const result = await playlistService.startProcess(
      playlistName,
      screens,
      stampLastApplied,
      async (screenKeys, args, options) => {
        await this.launchPlaylist(screenKeys, args, options, playlistName)
        started = screenKeys
      },
    )
    // A playlist the user starts plays, even on a screen that was paused
    if (started.length > 0) await this.pauseScreens(started, false)
    return result
  }

  // Apply an installed wallpaper, preferring one that is not already showing.
  // The library scan happens outside the queue, so it never holds up process work
  private async applyRandom(screen?: string): Promise<ApplyResult> {
    const wallpapers = await this.getWallpapers()
    if (wallpapers.length === 0) return { success: false, error: 'No wallpapers installed' }

    const activeIds = new Set(
      [...this.supervisor.screens().values()].map((active) => active.options.backgroundId),
    )
    const pick = pickRandomWallpaper(wallpapers, activeIds)
    const settings = await settingsService.loadSettings()
    const options = buildApplyOptions(settings, { backgroundId: pick.path, screen })
    const result = await this.supervisor.run(() => this.applyWallpaper(options))
    return { ...result, wallpaperTitle: pick.title }
  }

  private async stopScreens(targetScreen?: string | string[]): Promise<MutationResult> {
    const settings = await settingsService.loadSettings()
    const requested = Array.isArray(targetScreen)
      ? targetScreen
      : targetScreen
        ? [targetScreen]
        : []
    // In window mode one windowed backend stands in for the screens; no screens means all
    const screens =
      requested.length === 0
        ? undefined
        : settings.windowMode
          ? [...requested, 'default']
          : requested
    const { stopped, remaining } = await this.supervisor.stop({ screens })
    // Respawn screens that shared a stopped backend
    await this.respawnGrouped(remaining)
    invalidationService.emit('wallpaper.stopped')
    return { success: true, screens: stopped.length > 0 ? stopped : requested }
  }

  private pausedScreens(): string[] {
    return [...this.supervisor.screens()]
      .filter(([, screen]) => screen.paused)
      .map(([screen]) => screen)
  }

  // Pause or resume the target screens, then report which ones flipped
  private async pauseScreens(
    screen: string | string[] | undefined,
    paused: boolean,
  ): Promise<MutationResult> {
    const { changed, failed } = await this.supervisor.setPaused(
      this.resolveTargetScreens(screen),
      paused,
    )
    if (changed.length > 0) {
      invalidationService.emit(paused ? 'wallpaper.paused' : 'wallpaper.resumed')
    }
    const reason = paused ? 'process is not running' : 'failed to resume frozen process'
    return {
      success: failed.length === 0,
      error: failed.length > 0 ? failed.map((s) => `${s}: ${reason}`).join('; ') : undefined,
      screens: changed.length > 0 ? changed : undefined,
    }
  }

  private resolveTargetScreens(screen?: string | string[]): string[] {
    const active = new Set(this.supervisor.screens().keys())
    if (Array.isArray(screen)) return screen.filter((target) => active.has(target))
    if (screen) return active.has(screen) ? [screen] : []
    return [...active]
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
        if (this.isShowing(mutation.wallpaperPath)) {
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
        if (this.isShowing(mutation.wallpaperPath)) {
          await this.supervisor.run(() => this.reapplyAll())
        }
        return
      }
    }
  }

  // Whether `backgroundId` is on a screen while the app has a backend running
  private isShowing(backgroundId: string): boolean {
    const screens = [...this.supervisor.screens().values()]
    if (!screens.some((screen) => screen.proc)) return false
    return screens.some((screen) => screen.options.backgroundId === backgroundId)
  }

  // Last apply time per wallpaper, for the "recent" sort
  private getAppliedHistory(): Record<string, number> {
    return this.activeStore.get('appliedHistory') ?? {}
  }

  private stampApplied(backgroundId: string): void {
    this.activeStore.set('appliedHistory', {
      ...this.getAppliedHistory(),
      [backgroundId]: Date.now(),
    })
    invalidationService.emit('wallpaper.getWallpapers')
  }

  // ── Diagnose ───────────────────────────────────────────────────────────

  async diagnose(action: ServiceAction): Promise<DebugInfo | MutationResult | void> {
    switch (action.kind) {
      case 'getLogs':
        return this.debugLogs.get(action.screen) ?? { command: '', logs: [] }

      case 'clearLogs':
        this.debugLogs.delete(action.screen)
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

    for (const [screen, { options: wallpaper, playlist, paused }] of this.supervisor.screens()) {
      const cached = allWallpapers.find((w) => w.path === wallpaper.backgroundId)
      const project = cached ? null : await readProjectSummary(wallpaper.backgroundId)
      const title =
        cached?.title ??
        project?.title ??
        wallpaper.backgroundId.split('/').filter(Boolean).pop() ??
        'Unknown'
      const thumbnail = cached?.thumbnail ?? project?.thumbnail ?? ''

      result.push({ screen, wallpaper, ...(playlist && { playlist }), title, thumbnail, paused })
    }

    return result
  }

  // ── Private: process spawning ──────────────────────────────────────────

  private async applyWallpaper(options: ApplyWallpaperOptions): Promise<MutationResult> {
    const backendInstalled = await this.checkBackendInstalled()
    if (!backendInstalled) {
      return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
    }

    if (options.windowed) {
      // A new wallpaper replaces the windowed one outright, paused or not
      await this.supervisor.stop({ screens: ['default'] })
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
    const { remaining } = await this.supervisor.stop({ screens: targetScreens })
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
    return this.launchChecked(['default'], args, options)
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
    return this.launchChecked(screens, args, options)
  }

  // Launch, then report a backend that dies straight away as a failed apply
  private async launchChecked(
    screens: string[],
    args: string[],
    options: ApplyWallpaperOptions,
  ): Promise<MutationResult> {
    try {
      const proc = await this.launch(screens, args, options)
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

  /**
   * Replace whatever draws on `screens` with a backend running `args`, and
   * record it as their wallpaper, or their `playlist` when it runs one.
   * Wallpapers and playlists both start here.
   */
  private async launch(
    screens: string[],
    args: string[],
    options: ApplyWallpaperOptions,
    playlist?: string,
  ): Promise<ChildProcess> {
    const debugMode = settingsService.getSetting('debugMode')
    const proc = await this.supervisor.start(args, {
      screens,
      wallpaper: options,
      playlist,
      stdio: debugMode ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'],
      onExit: (lostScreens) => this.handleLostScreens(lostScreens),
    })
    compatibilityService.monitorProcess(proc, options.backgroundId)
    this.captureDebugLogs(proc, screens[0] ?? 'default', args)
    return proc
  }

  // A playlist's backend is started by the playlist runner through this callback
  private async launchPlaylist(
    screens: string[],
    args: string[],
    options: ApplyWallpaperOptions,
    playlist: string,
  ): Promise<void> {
    await this.launch(screens, args, options, playlist)
    invalidationService.emit('wallpaper.applied')
  }

  // A backend exited without being stopped: the screens it still drove lost their wallpaper
  private handleLostScreens(screens: string[]): void {
    if (screens.length > 0) invalidationService.emit('wallpaper.stopped')
  }

  // Wait briefly to detect if the spawned process exits immediately (failed apply).
  private async exitedEarly(proc: ChildProcess, graceMs = 100): Promise<boolean> {
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

  // ── Private: reapply ───────────────────────────────────────────────────

  private async reapplyAll(): Promise<MutationResult> {
    const errors: string[] = []
    const pausedScreens = this.pausedScreens()
    const settings = await settingsService.loadSettings()
    const grouped = new Map<string, { screens: string[]; options: ApplyWallpaperOptions }>()

    // Screens running a playlist restart their playlist process (which picks
    // up current global settings) instead of being flattened to a single
    // wallpaper.
    const active = [...this.supervisor.screens()].map(([screen, { options, playlist }]) => ({
      screen,
      options,
      playlist,
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
    const repause = await this.pauseScreens(pausedScreens, true)
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
    await this.pauseScreens(paused, true)
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

  // Split screens between those running a playlist and the rest
  private partitionByPlaylist<T extends { screen: string; playlist?: string }>(
    entries: T[],
  ): {
    playlistScreens: Map<string, string[]>
    wallpaperRemaining: T[]
  } {
    const playlistScreens = new Map<string, string[]>()
    const wallpaperRemaining: T[] = []

    for (const entry of entries) {
      if (entry.playlist) {
        const screens = playlistScreens.get(entry.playlist)
        if (screens) {
          screens.push(entry.screen)
        } else {
          playlistScreens.set(entry.playlist, [entry.screen])
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
        (screenKeys, args, options) => this.launchPlaylist(screenKeys, args, options, name),
      )
      if (!result.success) {
        // The playlist is gone (e.g. deleted), so its screens stop rather than stay marked as playing it
        await this.supervisor.stop({ screens })
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
      void this.supervisor.run(() => this.reapplyAll())
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

  private captureDebugLogs(proc: ChildProcess, debugKey: string, args: string[]): void {
    const debugMode = settingsService.getSetting('debugMode')
    if (!debugMode) return

    const commandStr = isFlatpak()
      ? `flatpak-spawn --host linux-wallpaperengine ${args.join(' ')}`
      : `linux-wallpaperengine ${args.join(' ')}`

    const logs: string[] = []
    this.debugLogs.set(debugKey, { command: commandStr, logs })

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
