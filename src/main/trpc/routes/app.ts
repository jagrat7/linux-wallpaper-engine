import { app } from 'electron'
import { trpc } from '../trpc'
import { GITHUB_REPO } from '../../../shared/constants/app'

interface GithubRelease {
  tag_name: string
  html_url: string
}

function stripV(version: string): string {
  return version.replace(/^v/, '')
}

export const appRouter = trpc.router({
  checkUpdate: trpc.procedure.query(async () => {
    const currentVersion = app.getVersion()

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'User-Agent': 'linux-wallpaper-engine' },
      })

      if (!res.ok) return { hasUpdate: false, latestVersion: null, releaseUrl: null }

      const release = await res.json() as GithubRelease
      const latestVersion = stripV(release.tag_name)
      const hasUpdate = latestVersion !== stripV(currentVersion)

      return { hasUpdate, latestVersion, releaseUrl: release.html_url }
    } catch {
      return { hasUpdate: false, latestVersion: null, releaseUrl: null }
    }
  }),
})
