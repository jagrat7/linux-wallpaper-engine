import type { BrowserWindow } from 'electron'
import { APP_PAGE_ROUTES, type AppPage } from '../../shared/constants/navigation'

const isAppPage = (page: unknown): page is AppPage =>
  typeof page === 'string' && Object.hasOwn(APP_PAGE_ROUTES, page)

/** Read a supported page from --page <name> or --page=<name>; ignore invalid input. */
export const pageFromArgv = (argv: readonly string[]): AppPage | undefined => {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') break
    const page =
      arg === '--page' ? argv[index + 1] : arg?.startsWith('--page=') ? arg.slice(7) : undefined
    if (isAppPage(page)) return page
  }
  return undefined
}

/** Validate structured launch data delivered by Electron's single-instance lock. */
export const pageFromLaunchData = (data: unknown): AppPage | undefined => {
  if (typeof data === 'object' && data !== null && 'page' in data && isAppPage(data.page)) {
    return data.page
  }
  return undefined
}

/** Reveal hidden and minimized windows, including those started in the tray. */
export const showMainWindow = (window: BrowserWindow): void => {
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
}

/** Change only the hash so navigation preserves the running renderer's state. */
export const navigateToPage = (window: BrowserWindow, page: AppPage): void => {
  // executeJavaScript waits for an in-progress page load to finish. Only allowlisted
  // routes reach this expression; never interpolate raw command-line arguments.
  void window.webContents
    .executeJavaScript(`window.location.hash = ${JSON.stringify(APP_PAGE_ROUTES[page])}`)
    .catch((error: unknown) => console.error('Failed to open app page:', error))
}
