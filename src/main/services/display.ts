import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { hostExecAsync } from '../utils/host'
import { settingsService } from './settings'


export interface Display {
  id: string
  name: string
  resolution: string
  width: number
  height: number
  x: number
  y: number
  refreshRate: number
  primary: boolean
  connected: boolean
  degraded: boolean
}

export const displayService = {
  async detectDisplays(): Promise<Display[]> {
    const displays: Display[] = []

    // Try xrandr first (X11)
    try {
      const { stdout } = await hostExecAsync('xrandr --query')
      const lines = stdout.split('\n')

      // Regex to match: Name connected [primary] WxH+X+Y ...
      const pattern = /^(\S+)\s+connected\s+(primary\s+)?(\d+)x(\d+)\+(\d+)\+(\d+)/

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(pattern)
        if (match) {
          const [, name, primaryStr, width, height, x, y] = match

          // Look for refresh rate in the next line (mode line)
          // Example: "   1920x1080     60.00*+  59.93"
          let refreshRate = 60 // Default fallback
          if (i + 1 < lines.length) {
            const modeLine = lines[i + 1]
            const rateMatch = modeLine.match(/(\d+\.\d+)\*/)
            if (rateMatch) {
              refreshRate = Math.round(parseFloat(rateMatch[1]))
            }
          }

          displays.push({
            id: name,
            name,
            resolution: `${width}x${height}`,
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            x: parseInt(x, 10),
            y: parseInt(y, 10),
            refreshRate,
            primary: !!primaryStr,
            connected: true,
            degraded: false,
          })
        }
      }

      if (displays.length > 0) {
        return this.applyNameOverrides(displays)
      }
    } catch {
      // xrandr not available or failed, try Wayland
    }

    // Try hyprctl (Hyprland) — guaranteed available on Hyprland, unlike wlr-randr
    try {
      const { stdout } = await hostExecAsync('hyprctl monitors -j')
      const monitors = JSON.parse(stdout) as Array<{
        name: string
        width: number
        height: number
        refreshRate: number
        x: number
        y: number
        focused: boolean
        disabled?: boolean
      }>

      for (const m of monitors) {
        if (m.disabled) continue
        displays.push({
          id: m.name,
          name: m.name,
          resolution: `${m.width}x${m.height}`,
          width: m.width,
          height: m.height,
          x: m.x,
          y: m.y,
          refreshRate: Math.round(m.refreshRate),
          primary: m.focused || displays.length === 0,
          connected: true,
          degraded: false,
        })
      }

      if (displays.length > 0) {
        return this.applyNameOverrides(displays)
      }
    } catch {
      // hyprctl not available (not Hyprland) or failed
    }

    // Try wlr-randr (Wayland with wlroots-based compositors)
    try {
      const { stdout } = await hostExecAsync('wlr-randr')
      const lines = stdout.split('\n')

      let currentDisplay: Partial<Display> | null = null

      for (const line of lines) {
        // Output line: "eDP-1 \"AU Optronics 0x243D\" (1920x1080, scale 1.00)"
        const outputMatch = line.match(/^(\S+)\s+"[^"]*"\s+\((\d+)x(\d+)/)
        if (outputMatch) {
          if (currentDisplay && currentDisplay.name) {
            displays.push(currentDisplay as Display)
          }
          const [, name, width, height] = outputMatch
          currentDisplay = {
            id: name,
            name,
            resolution: `${width}x${height}`,
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            x: 0,
            y: 0,
            refreshRate: 60, // Default for Wayland
            primary: displays.length === 0, // First one is primary
            connected: true,
            degraded: false,
          }
        }

        if (currentDisplay) {
          // Refresh rate line: "    1920x1080 px, 144.000 Hz (preferred, current)"
          const rateMatch = line.match(/([\d.]+)\s*Hz.*current/)
          if (rateMatch) {
            currentDisplay.refreshRate = Math.round(parseFloat(rateMatch[1]))
          }

          // Position line: "  Position: 0,0"
          const posMatch = line.match(/Position:\s*(\d+),(\d+)/)
          if (posMatch) {
            currentDisplay.x = parseInt(posMatch[1], 10)
            currentDisplay.y = parseInt(posMatch[2], 10)
          }
        }
      }

      if (currentDisplay && currentDisplay.name) {
        displays.push(currentDisplay as Display)
      }

      if (displays.length > 0) {
        return this.applyNameOverrides(displays)
      }
    } catch {
      // wlr-randr not available or failed
    }

    // Try gnome-randr for GNOME Wayland
    try {
      const { stdout } = await hostExecAsync('gnome-randr query')
      // Parse gnome-randr output (format varies)
      const lines = stdout.split('\n')

      for (const line of lines) {
        // Basic parsing for connected displays
        const match = line.match(/^(\S+)\s+(\d+)x(\d+)\+(\d+)\+(\d+)/)
        if (match) {
          const [, name, width, height, x, y] = match
          displays.push({
            id: name,
            name,
            resolution: `${width}x${height}`,
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            x: parseInt(x, 10),
            y: parseInt(y, 10),
            refreshRate: 60, // Default for gnome-randr
            primary: displays.length === 0,
            connected: true,
            degraded: false,
          })
        }
      }

      if (displays.length > 0) {
        return this.applyNameOverrides(displays)
      }
    } catch {
      // gnome-randr not available
    }

    // Fallback: parse /sys/class/drm/ for connector names (kernel-level, no dependencies)
    // sysfs modes file doesn't include refresh rate, so use the user's setting if available
    try {
      const drmPath = '/sys/class/drm'
      const entries = await fs.readdir(drmPath)
      const connectorPattern = /^card\d+-(.+)$/
      const fallbackRefreshRate = settingsService.getSetting('maxRefreshRate')
        ?? settingsService.getSetting('fps')

      for (const entry of entries) {
        const match = entry.match(connectorPattern)
        if (!match) continue

        const connectorName = match[1]
        // Skip virtual connectors
        if (connectorName.startsWith('Writeback')) continue

        const entryPath = path.join(drmPath, entry)
        const status = (await fs.readFile(path.join(entryPath, 'status'), 'utf-8')).trim()
        if (status !== 'connected') continue

        let width = 1920
        let height = 1080
        try {
          const modes = (await fs.readFile(path.join(entryPath, 'modes'), 'utf-8')).trim()
          const firstMode = modes.split('\n')[0]
          const modeMatch = firstMode?.match(/(\d+)x(\d+)/)
          if (modeMatch) {
            width = parseInt(modeMatch[1], 10)
            height = parseInt(modeMatch[2], 10)
          }
        } catch { /* modes file may not exist */ }

        displays.push({
          id: connectorName,
          name: connectorName,
          resolution: `${width}x${height}`,
          width,
          height,
          x: 0,
          y: 0,
          refreshRate: fallbackRefreshRate,
          primary: displays.length === 0,
          connected: true,
          degraded: true,
        })
      }

      if (displays.length > 0) {
        return this.applyNameOverrides(displays)
      }
    } catch {
      // /sys/class/drm not accessible
    }

    // Last resort fallback
    const fallbackFps = settingsService.getSetting('maxRefreshRate')
      ?? settingsService.getSetting('fps')
    return [
      {
        id: 'default',
        name: 'Unknown Display',
        resolution: '1920x1080',
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        refreshRate: fallbackFps,
        primary: true,
        connected: true,
        degraded: true,
      },
    ]
  },

  applyNameOverrides(displays: Display[]): Display[] {
    const overrides = settingsService.getSetting('displayNameOverrides')
    return displays.map(d => {
      const override = overrides[d.id]
      return override ? { ...d, name: override } : d
    })
  },

  async getDisplaySession(): Promise<'x11' | 'wayland' | 'unknown'> {
    const sessionType = process.env.XDG_SESSION_TYPE?.toLowerCase()

    if (sessionType === 'x11') return 'x11'
    if (sessionType === 'wayland') return 'wayland'

    // Try to detect from DISPLAY/WAYLAND_DISPLAY env vars
    if (process.env.WAYLAND_DISPLAY) return 'wayland'
    if (process.env.DISPLAY) return 'x11'

    return 'unknown'
  },

  async getMaxRefreshRate(): Promise<number> {
    const displays = await displayService.detectDisplays()
    const maxRate = Math.max(...displays.map(d => d.refreshRate))
    return maxRate
  },
}
