import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import packageJson from '../../../package.json'

const home = os.homedir()

// Match Electron's app.getPath('userData'): ~/.config/<productName or name>
const userDataDir = path.join(home, '.config', packageJson.productName ?? packageJson.name)

export const app = {
  getPath(name: string): string {
    switch (name) {
      case 'home': return home
      case 'userData': return userDataDir
      case 'appData': return path.join(home, '.config')
      case 'temp': return os.tmpdir()
      case 'exe': return process.execPath
      case 'desktop': return path.join(home, 'Desktop')
      case 'documents': return path.join(home, 'Documents')
      case 'downloads': return path.join(home, 'Downloads')
      default: return home
    }
  },
  getName(): string {
    return packageJson.productName ?? packageJson.name
  },
  getVersion(): string {
    return packageJson.version
  },
  getAppPath(): string {
    return process.cwd()
  },
  isPackaged: false,
  setLoginItemSettings(_settings: { openAtLogin: boolean; path?: string }): void {},
  whenReady(): Promise<void> {
    return Promise.resolve()
  },
  on(_event: string, _listener: (...args: unknown[]) => void): void {},
  once(_event: string, _listener: (...args: unknown[]) => void): void {},
  quit(): void {
    process.exit(0)
  },
  requestSingleInstanceLock(): boolean {
    return true
  },
}

export const shell = {
  async openExternal(url: string): Promise<void> {
    const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
    child.unref()
  },
  async openPath(target: string): Promise<string> {
    const child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' })
    child.unref()
    return ''
  },
}

export class BrowserWindow {
  static getFocusedWindow(): BrowserWindow | null {
    return null
  }
  static getAllWindows(): BrowserWindow[] {
    return []
  }
  isMaximized(): boolean {
    return false
  }
  maximize(): void {}
  isVisible(): boolean {
    return false
  }
  isFocused(): boolean {
    return false
  }
  show(): void {}
  focus(): void {}
  hide(): void {}
  on(_event: string, _listener: (...args: unknown[]) => void): void {}
  loadURL(_url: string): Promise<void> {
    return Promise.resolve()
  }
}

export const screen = new EventEmitter()

class NativeTheme extends EventEmitter {
  get shouldUseDarkColors(): boolean {
    return true
  }
}

export const nativeTheme = new NativeTheme()
export const systemPreferences = new EventEmitter()

export class Tray extends EventEmitter {
  setToolTip(_text: string): void {}
  setContextMenu(_menu: unknown): void {}
  destroy(): void {}
}

export class Menu {
  static buildFromTemplate(_template: unknown[]): Menu {
    return new Menu()
  }
}

export const MenuItem = class {}

export const protocol = {
  handle(_scheme: string, _handler: (request: Request) => unknown): void {},
}

export const net = {
  fetch: (input: string | URL | Request) => fetch(input as string),
}

export const nativeImage = {
  createFromPath(_p: string) {
    return { resize: (_s: { width: number; height: number }) => nativeImage.createFromPath(_p), isEmpty: () => true }
  },
  createEmpty() {
    return { isEmpty: () => true }
  },
}

export const ipcMain = new EventEmitter()
export const dialog = {}
export const Notification = class {}

export default {
  app,
  shell,
  BrowserWindow,
  screen,
  nativeTheme,
  systemPreferences,
  Tray,
  Menu,
  protocol,
  net,
  nativeImage,
  ipcMain,
  dialog,
  Notification,
}
