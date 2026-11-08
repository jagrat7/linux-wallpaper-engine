import type { ChildProcess, StdioOptions } from 'node:child_process'
import { hostExecFileAsync, hostExecFileSync, hostSpawn, shouldUseFlatpakSpawn } from './host'

interface BackendSpawnOptions {
  stdio: StdioOptions
  /** Runs when the backend exits on its own. Skipped once the app is quitting. */
  onExit?: () => void
}

/**
 * Sole owner of the linux-wallpaperengine processes this app instance starts.
 *
 * Every backend (wallpapers, playlists and compatibility scans) is spawned here,
 * so quitting can take all of them down. Process work that kills and respawns
 * backends runs through `run`, one task at a time, so two callers can never
 * interleave their kill → spawn sequences on the same screen.
 */
class BackendSupervisor {
  private live = new Set<ChildProcess>()
  private queue: Promise<unknown> = Promise.resolve()
  private stopping = false
  private pending = 0

  /** Run `task` once every task queued before it has settled. */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++
    const result = this.queue.then(task).finally(() => {
      this.pending--
    })
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Whether no task is running or waiting in `run`. */
  get isIdle(): boolean {
    return this.pending === 0
  }

  /** Whether the app is quitting: new backends are refused and exits are expected. */
  get isShuttingDown(): boolean {
    return this.stopping
  }

  /** Spawn a detached backend and track it until it exits. Throws once the app is quitting. */
  spawn(args: string[], { stdio, onExit }: BackendSpawnOptions): ChildProcess {
    if (this.stopping) throw new Error('The app is quitting')

    const proc = hostSpawn('linux-wallpaperengine', args, { detached: true, stdio })
    // Quit kills backends explicitly, so the event loop never has to wait on them
    proc.unref()
    this.live.add(proc)
    proc.once('exit', () => {
      this.live.delete(proc)
      if (!this.stopping) onExit?.()
    })
    return proc
  }

  /**
   * Kill every backend whose command line matches one of `patterns`. Reaches
   * backends this instance holds no handle for (left by a crashed run) and the
   * host backend behind a Flatpak handle. A pattern with no match is fine.
   */
  async killMatching(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await hostExecFileAsync('pkill', ['-9', '-f', pattern]).catch(() => undefined)
    }
  }

  /**
   * Kill every tracked backend and refuse new ones. Saved wallpaper state is
   * left alone. Synchronous, so it finishes inside Electron's quit sequence:
   * pausing that sequence for async work leaves a signal-driven quit hanging.
   *
   * @param hostPatterns Also killed by command line under Flatpak, where a
   *   handle only reaches flatpak-spawn and not the host backend behind it
   */
  shutdown(hostPatterns: string[] = []): void {
    this.stopping = true
    const flatpak = shouldUseFlatpakSpawn()
    // flatpak-spawn forwards SIGTERM to the host backend but would die alone on SIGKILL
    const signal = flatpak ? 'SIGTERM' : 'SIGKILL'
    for (const proc of this.live) {
      try {
        proc.kill(signal)
      } catch {
        /* already dead */
      }
    }
    this.live.clear()
    if (!flatpak) return
    for (const pattern of hostPatterns) {
      hostExecFileSync('pkill', ['-9', '-f', pattern])
    }
  }
}

export const backendSupervisor = new BackendSupervisor()
