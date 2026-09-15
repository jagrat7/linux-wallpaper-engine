import { execFileSync } from 'node:child_process'
import type { SystemThemePlatform } from '../main/services/system-theme/system-theme.interface'
import type { ThemeScheme } from '../main/services/system-theme/system-theme.types'

const POLL_MS = 10_000

// Read the freedesktop portal color-scheme over D-Bus.
// Returns 1 (dark), 2 (light), 0 (no preference).
function readPortalScheme(): ThemeScheme | null {
  try {
    const out = execFileSync(
      'dbus-send',
      [
        '--session', '--print-reply=literal',
        '--dest=org.freedesktop.portal.Desktop',
        '/org/freedesktop/portal/desktop',
        'org.freedesktop.portal.Settings.Read',
        'string:org.freedesktop.appearance',
        'string:color-scheme',
      ],
      { encoding: 'utf-8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const match = out.match(/uint32\s+(\d+)/)
    if (!match) return null
    if (match[1] === '1') return 'dark'
    if (match[1] === '2') return 'light'
    return null
  } catch {
    return null
  }
}

// Non-Electron SystemThemePlatform: queries the XDG portal and polls for
// changes. detectSystemTheme() already reads the portal itself, so this is
// mostly a fallback + change trigger.
export function createDaemonPlatform(): SystemThemePlatform {
  let last: ThemeScheme = readPortalScheme() ?? 'dark'
  return {
    readScheme: () => last,
    subscribe(onChange) {
      const timer = setInterval(() => {
        const next = readPortalScheme() ?? last
        if (next !== last) {
          last = next
          onChange()
        }
      }, POLL_MS)
      timer.unref()
      return () => clearInterval(timer)
    },
  }
}
