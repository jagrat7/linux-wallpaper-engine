import { app } from 'electron'
import { trpc } from '../trpc'
import { GITHUB_REPO, type UpdateCheck } from '../../../shared/constants/app'
import { updaterService } from '../../services/updater'
import { isNewerVersion, stripVersionPrefix } from '../../utils/version'

interface GithubRelease {
  tag_name: string
  html_url: string
}

const releaseUrl = (version: string) => `https://github.com/${GITHUB_REPO}/releases/tag/v${version}`

/** The latest GitHub release, for installs that update through their package manager */
const checkGithubRelease = async (): Promise<UpdateCheck> => {
  const noUpdate = { hasUpdate: false, latestVersion: null, releaseUrl: null, canAutoUpdate: false }
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'linux-wallpaper-engine' },
    })
    if (!res.ok) return noUpdate

    const release = (await res.json()) as GithubRelease
    const latestVersion = stripVersionPrefix(release.tag_name)
    const hasUpdate = isNewerVersion(latestVersion, app.getVersion())
    return { hasUpdate, latestVersion, releaseUrl: release.html_url, canAutoUpdate: false }
  } catch {
    return noUpdate
  }
}

export const appRouter = trpc.router({
  checkUpdate: trpc.procedure.query(async (): Promise<UpdateCheck> => {
    if (updaterService.canAutoUpdate) {
      // The AppImage asks its update feed, so it only offers what it can install
      try {
        const { latestVersion, hasUpdate } = await updaterService.check()
        return {
          hasUpdate,
          latestVersion,
          releaseUrl: releaseUrl(latestVersion),
          canAutoUpdate: true,
        }
      } catch (error) {
        console.error('AppImage update check failed, falling back to GitHub releases:', error)
      }
    }
    return checkGithubRelease()
  }),

  updateStatus: trpc.procedure.query(() => updaterService.getStatus()),

  // Returns at once; the banner follows progress through updateStatus
  downloadUpdate: trpc.procedure.mutation(() => {
    void updaterService.download()
  }),

  installUpdate: trpc.procedure.mutation(() => {
    updaterService.install()
  }),
})
