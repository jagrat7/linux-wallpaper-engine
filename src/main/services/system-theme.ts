import { nativeTheme } from 'electron'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import Color, { type ColorInstance } from 'color'
import { hostExecAsync } from '../utils/host'
import type { SystemColorScheme, SystemTheme, SystemThemePalette } from '../../shared/constants/theme'

const PORTAL_BUS = 'org.freedesktop.portal.Desktop'
const PORTAL_PATH = '/org/freedesktop/portal/desktop'
const PORTAL_INTERFACE = 'org.freedesktop.portal.Settings'
const APPEARANCE_NAMESPACE = 'org.freedesktop.appearance'

const PYWAL_COLORS_JSON = '~/.cache/wal/colors.json'
const OMARCHY_COLORS_TOML = '~/.config/omarchy/current/theme/colors.toml'

const POLL_INTERVAL_MS = 5000

const emitter = new EventEmitter()
let lastTheme: SystemTheme | null = null
let pollTimer: NodeJS.Timeout | null = null
let activeSubscriberCount = 0

function expandHome(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (v: number) =>
    Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function parseColorSchemeValue(stdout: string): SystemColorScheme | null {
  // gdbus: "(<<uint32 1>>,)", dbus-send: "uint32 1", busctl: "v v u 1"
  const match = stdout.match(/(?:uint32|\bu)\s+(\d+)/)
  if (!match) return null

  const value = Number(match[1])
  if (value === 1) return 'dark'
  if (value === 2) return 'light'
  return 'no-preference'
}

function parseAccentColorValue(stdout: string): string | null {
  // gdbus tuple: "(<<(0.4, 0.2, 1.0)>>,)"
  const gdbusTuple = stdout.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/)
  if (gdbusTuple) {
    return rgbToHex(
      Number(gdbusTuple[1]) * 255,
      Number(gdbusTuple[2]) * 255,
      Number(gdbusTuple[3]) * 255,
    )
  }

  // busctl tuple: "v v (ddd) 0.4 0.2 1"
  const busctlTuple = stdout.match(/\(ddd\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (busctlTuple) {
    return rgbToHex(
      Number(busctlTuple[1]) * 255,
      Number(busctlTuple[2]) * 255,
      Number(busctlTuple[3]) * 255,
    )
  }

  // dbus-send tuple: "struct { double 0.4; double 0.2; double 1.0; }"
  const dbusDoubles = [...stdout.matchAll(/double\s+([\d.]+)/g)]
  if (dbusDoubles.length >= 3) {
    return rgbToHex(
      Number(dbusDoubles[0][1]) * 255,
      Number(dbusDoubles[1][1]) * 255,
      Number(dbusDoubles[2][1]) * 255,
    )
  }

  // No preference is reported as a uint32 0
  const noPref = stdout.match(/(?:uint32|\bu)\s+(\d+)/)
  if (noPref && Number(noPref[1]) === 0) return null

  return null
}

async function readPortalSetting(key: string): Promise<string> {
  const gdbus = `gdbus call --session --dest ${PORTAL_BUS} --object-path ${PORTAL_PATH} --method ${PORTAL_INTERFACE}.Read ${APPEARANCE_NAMESPACE} ${key}`
  try {
    const { stdout } = await hostExecAsync(gdbus)
    return stdout
  } catch {
    // fall through
  }

  const busctl = `busctl --user call ${PORTAL_BUS} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read ss ${APPEARANCE_NAMESPACE} ${key}`
  try {
    const { stdout } = await hostExecAsync(busctl)
    return stdout
  } catch {
    // fall through
  }

  const dbusSend = `dbus-send --session --print-reply --dest=${PORTAL_BUS} ${PORTAL_PATH} ${PORTAL_INTERFACE}.Read string:${APPEARANCE_NAMESPACE} string:${key}`
  const { stdout } = await hostExecAsync(dbusSend)
  return stdout
}

async function getPortalScheme(): Promise<SystemColorScheme | null> {
  try {
    const stdout = await readPortalSetting('color-scheme')
    return parseColorSchemeValue(stdout)
  } catch {
    return null
  }
}

async function getPortalAccent(): Promise<string | null> {
  try {
    const stdout = await readPortalSetting('accent-color')
    return parseAccentColorValue(stdout)
  } catch {
    return null
  }
}

function pickVibrantAccent(colors?: Record<string, string>): string | null {
  if (!colors) return null

  const candidateKeys = Object.keys(colors).filter((key) => /^color[1-6]$/.test(key))
  if (candidateKeys.length === 0) return null

  let best: { hex: string, chroma: number } | null = null
  for (const key of candidateKeys) {
    const hex = colors[key]
    if (!hex) continue
    try {
      const [, chroma] = (Color(hex).oklch() as ColorInstance).array()
      if (!best || chroma > best.chroma) {
        best = { hex, chroma }
      }
    } catch {
      // ignore invalid colors
    }
  }

  return best?.hex ?? null
}

async function readPywalPalette(): Promise<SystemThemePalette | null> {
  try {
    const content = await fs.readFile(expandHome(PYWAL_COLORS_JSON), 'utf-8')
    const data = JSON.parse(content) as {
      special?: { background?: string, foreground?: string, cursor?: string }
      colors?: Record<string, string>
    }

    const background = data.special?.background
    const foreground = data.special?.foreground
    if (!background || !foreground) return null

    const accent = pickVibrantAccent(data.colors) ?? foreground
    return {
      background,
      foreground,
      accent,
      cursor: data.special?.cursor,
      colors: data.colors,
    }
  } catch {
    return null
  }
}

async function readOmarchyPalette(): Promise<SystemThemePalette | null> {
  try {
    const content = await fs.readFile(expandHome(OMARCHY_COLORS_TOML), 'utf-8')
    const values = new Map<string, string>()

    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*["']#?([0-9a-fA-F]{6})["']/)
      if (match) {
        values.set(match[1], `#${match[2].toLowerCase()}`)
      }
    }

    const background = values.get('background')
    const foreground = values.get('foreground')
    const accent = values.get('accent')
    if (!background || !foreground || !accent) return null

    const colors: Record<string, string> = {}
    for (let i = 0; i < 16; i++) {
      const value = values.get(`color${i}`)
      if (value) colors[`color${i}`] = value
    }

    return {
      background,
      foreground,
      accent,
      cursor: values.get('cursor'),
      colors,
    }
  } catch {
    return null
  }
}

async function detectSystemTheme(): Promise<SystemTheme> {
  const [portalScheme, portalAccent, omarchyPalette, pywalPalette] = await Promise.all([
    getPortalScheme(),
    getPortalAccent(),
    readOmarchyPalette(),
    readPywalPalette(),
  ])

  let scheme: SystemColorScheme = portalScheme ?? 'no-preference'
  let accent: string | null = portalAccent
  let palette: SystemThemePalette | null = omarchyPalette ?? pywalPalette

  if (!accent && palette) {
    accent = palette.accent
  }

  if (scheme === 'no-preference') {
    scheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  return { scheme, accent, palette }
}

function startPolling(): void {
  if (pollTimer) return

  detectSystemTheme()
    .then((theme) => {
      lastTheme = theme
      emitter.emit('change', theme)
    })
    .catch(() => {
      // ignore initial detection errors
    })

  pollTimer = setInterval(async () => {
    try {
      const theme = await detectSystemTheme()
      if (JSON.stringify(theme) !== JSON.stringify(lastTheme)) {
        lastTheme = theme
        emitter.emit('change', theme)
      }
    } catch {
      // ignore polling errors
    }
  }, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export const systemThemeService = {
  async get(): Promise<SystemTheme> {
    const theme = await detectSystemTheme()
    lastTheme = theme
    return theme
  },

  subscribe(callback: (theme: SystemTheme) => void): () => void {
    activeSubscriberCount++
    if (activeSubscriberCount === 1) startPolling()

    emitter.on('change', callback)
    if (lastTheme) callback(lastTheme)

    return () => {
      emitter.off('change', callback)
      activeSubscriberCount--
      if (activeSubscriberCount === 0) stopPolling()
    }
  },
}
