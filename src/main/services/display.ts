import { hostExecAsync } from './flatpak'

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
}

class DisplayService {
  private static instance: DisplayService | null = null

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  static getInstance(): DisplayService {
    if (!DisplayService.instance) {
      DisplayService.instance = new DisplayService()
    }
    return DisplayService.instance
  }

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
          })
        }
      }

      if (displays.length > 0) {
        return displays
      }
    } catch {
      // xrandr not available or failed, try Wayland
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
          }
        }

        // Position line: "Position: 0,0"
        if (currentDisplay) {
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
        return displays
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
          })
        }
      }

      if (displays.length > 0) {
        return displays
      }
    } catch {
      // gnome-randr not available
    }

    // Fallback: return a default display
    return [
      {
        id: 'default',
        name: 'Unknown Display',
        resolution: '1920x1080',
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        refreshRate: 60,
        primary: true,
        connected: true,
      },
    ]
  }

  async getDisplaySession(): Promise<'x11' | 'wayland' | 'unknown'> {
    const sessionType = process.env.XDG_SESSION_TYPE?.toLowerCase()

    if (sessionType === 'x11') return 'x11'
    if (sessionType === 'wayland') return 'wayland'

    // Try to detect from DISPLAY/WAYLAND_DISPLAY env vars
    if (process.env.WAYLAND_DISPLAY) return 'wayland'
    if (process.env.DISPLAY) return 'x11'

    return 'unknown'
  }

  async getMaxRefreshRate(): Promise<number> {
    const displays = await this.detectDisplays()
    const maxRate = Math.max(...displays.map(d => d.refreshRate))
    return maxRate
  }
}

// Export singleton instance
export const displayService = DisplayService.getInstance()
