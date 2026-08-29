import { hostExecAsync } from '../../utils/host'
import type { SystemTheme } from './system-theme.types'

const PORTAL_DESTINATION = 'org.freedesktop.portal.Desktop'
const PORTAL_PATH = '/org/freedesktop/portal/desktop'
const PORTAL_INTERFACE = 'org.freedesktop.portal.Settings'
const PORTAL_NAMESPACE = 'org.freedesktop.appearance'

export const readPortalSetting = async (setting: string): Promise<string | null> => {
  const commands = [
    `gdbus call --session --dest ${PORTAL_DESTINATION} --object-path ${PORTAL_PATH} --method ${PORTAL_INTERFACE}.Read ${PORTAL_NAMESPACE} ${setting}`,
    `busctl --user call ${PORTAL_DESTINATION} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read ss ${PORTAL_NAMESPACE} ${setting}`,
    `dbus-send --session --print-reply --dest=${PORTAL_DESTINATION} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read string:${PORTAL_NAMESPACE} string:${setting}`,
  ]

  for (const command of commands) {
    try {
      return (await hostExecAsync(command)).stdout
    } catch {
      continue
    }
  }
  return null
}

export const parsePortalScheme = (source: string | null): SystemTheme['scheme'] | null => {
  const value = source?.match(/(?:uint32|\bu)\s+(\d+)/)?.[1]
  if (value === '1') return 'dark'
  if (value === '2') return 'light'
  return null
}

export const parsePortalAccent = (source: string | null): string | null => {
  if (source === null) return null
  const tuple = source.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/)
    ?? source.match(/\(ddd\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (tuple !== null) return `color(srgb ${tuple[1]} ${tuple[2]} ${tuple[3]})`

  const values = Array.from(source.matchAll(/double\s+([\d.]+)/g))
  return values.length >= 3
    ? `color(srgb ${values[0][1]} ${values[1][1]} ${values[2][1]})`
    : null
}
