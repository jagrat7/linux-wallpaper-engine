import type { BrowserWindow } from 'electron'
import { APP_PAGE_ROUTES, type AppPage } from '../../shared/constants/app'

const isAppPage = (value: unknown): value is AppPage =>
  typeof value === 'string' && Object.hasOwn(APP_PAGE_ROUTES, value)

/** The page asked for with `--page <name>` or `--page=<name>`. Unknown names are ignored. */
export const pageFromArgv = (argv: readonly string[]): AppPage | undefined => {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') break
    const value =
      arg === '--page' ? argv[index + 1] : arg?.startsWith('--page=') ? arg.slice(7) : undefined
    if (isAppPage(value)) return value
  }
  return undefined
}

/**
 * The page a second launch asked for, from the data it handed over with the
 * single-instance lock. Its argv can't be used: Chromium reorders it on Linux,
 * splitting `--page` from its value.
 */
export const pageFromLaunchData = (data: unknown): AppPage | undefined =>
  typeof data === 'object' && data !== null && 'page' in data && isAppPage(data.page)
    ? data.page
    : undefined

/** Bring the window to the front, out of the tray or a minimized state, optionally on `page`. */
export const revealWindow = (window: BrowserWindow, page?: AppPage): void => {
  if (page) {
    // Only the hash changes, so the renderer keeps its state. The route comes from
    // the allowlist above, never straight from the command line
    void window.webContents
      .executeJavaScript(`location.hash = ${JSON.stringify(APP_PAGE_ROUTES[page])}`)
      .catch((error: unknown) => console.error(`Opening the ${page} page failed:`, error))
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
