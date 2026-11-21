import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateDownloadStatus } from '../../shared/constants/app'
import { invalidationService } from './invalidation'

/**
 * Updates the AppImage in place with electron-updater, from the `latest-linux.yml`
 * the Release workflow attaches to each GitHub release. deb, rpm, AUR and Nix installs
 * update through their package manager, so this service only serves the AppImage.
 */
class UpdaterService {
  private status: UpdateDownloadStatus = { state: 'idle', version: null }
  // The version the last check found; downloadUpdate() fetches that release
  private latestVersion: string | null = null

  /**
   * Whether this install can replace itself: only a packaged AppImage, which the
   * AppImage runtime marks by setting APPIMAGE to the .AppImage file's path.
   */
  get canAutoUpdate(): boolean {
    return app.isPackaged && Boolean(process.env.APPIMAGE)
  }

  /**
   * Reads the latest release from the update feed without downloading it.
   * @returns the latest version and whether it is newer than the running one
   */
  async check(): Promise<{ latestVersion: string; hasUpdate: boolean }> {
    autoUpdater.autoDownload = false
    // Full releases only, even when this build is a pre-release, which electron-updater
    // would otherwise move onto a pre-release feed the Release workflow doesn't publish
    autoUpdater.allowPrerelease = false
    const result = await autoUpdater.checkForUpdates()
    const latestVersion = result?.updateInfo.version ?? app.getVersion()
    this.latestVersion = latestVersion
    // electron-updater compares full semver, so 0.5.0 counts as newer than 0.5.0-beta.1
    return { latestVersion, hasUpdate: Boolean(result?.isUpdateAvailable) }
  }

  /** Where the download stands; the renderer refetches it on `app.updateStatus`. */
  getStatus(): UpdateDownloadStatus {
    return this.status
  }

  /**
   * Downloads the latest release in the background. Progress is reported through
   * getStatus() and the `app.updateStatus` invalidation, not the returned promise.
   */
  async download(): Promise<void> {
    if (!this.canAutoUpdate) return
    if (this.status.state === 'downloading' || this.status.state === 'ready') return

    try {
      if (!this.latestVersion) await this.check()
      this.setStatus({ state: 'downloading', version: this.latestVersion })
      await autoUpdater.downloadUpdate()
      this.setStatus({ state: 'ready', version: this.latestVersion })
    } catch (error) {
      console.error('AppImage update download failed:', error)
      this.setStatus({ state: 'failed', version: this.latestVersion })
    }
  }

  /**
   * Quits, replaces the .AppImage file with the downloaded one, and starts it. If the
   * file can't be replaced, such as in a folder the user can't write to, the app keeps
   * running and the status becomes `failed`.
   */
  install(): void {
    if (this.status.state !== 'ready') return
    // The new AppImage starts before this one exits; without the lock it can take over
    app.releaseSingleInstanceLock()
    const onError = (error: Error) => {
      console.error('AppImage update install failed:', error)
      app.requestSingleInstanceLock()
      this.setStatus({ state: 'failed', version: this.latestVersion })
    }
    autoUpdater.once('error', onError)
    autoUpdater.quitAndInstall()
    autoUpdater.off('error', onError)
  }

  private setStatus(status: UpdateDownloadStatus): void {
    this.status = status
    invalidationService.emit('app.updateStatus')
  }
}

export const updaterService = new UpdaterService()
