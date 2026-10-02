import { isFixtureMode, isBrowserDev } from '../../development/mode'
import { app } from 'electron'
import { trpc } from '../trpc'
import { GITHUB_REPO, APP_VERSION } from '../../../shared/constants/app'
import { isNewerVersion, stripVersionPrefix } from '../../utils/version'

interface GithubRelease {
  tag_name: string
  html_url: string
}

export const appRouter = trpc.router({
  checkUpdate: trpc.procedure.query(async () => {
    if (isFixtureMode) return { hasUpdate: false, latestVersion: null, releaseUrl: null }
    const currentVersion = isBrowserDev ? APP_VERSION : app.getVersion()

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'User-Agent': 'linux-wallpaper-engine' },
      })

      if (!res.ok) return { hasUpdate: false, latestVersion: null, releaseUrl: null }

      const release = (await res.json()) as GithubRelease
      const latestVersion = stripVersionPrefix(release.tag_name)
      const hasUpdate = isNewerVersion(latestVersion, currentVersion)

      return { hasUpdate, latestVersion, releaseUrl: release.html_url }
    } catch {
      return { hasUpdate: false, latestVersion: null, releaseUrl: null }
    }
  }),
})
