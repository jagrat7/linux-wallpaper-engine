import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import packageJson from '../../../package.json'

// Same directory Electron uses for userData: ~/.config/<productName or name>
const configDir = path.join(os.homedir(), '.config', packageJson.productName ?? packageJson.name)

/**
 * Minimal drop-in replacement for electron-store: a JSON file persisted at
 * the same path electron-store would use (<userData>/<name>.json), with the
 * same get/set/has/delete/clear/store surface this codebase relies on.
 */
export default class Store<T extends Record<string, unknown>> {
  private readonly filePath: string
  private readonly defaults: T
  private data: T

  constructor(options: { name: string; defaults: T; cwd?: string }) {
    this.defaults = options.defaults
    this.filePath = path.join(options.cwd ?? configDir, `${options.name}.json`)
    this.data = { ...this.defaults }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      this.data = { ...this.defaults, ...JSON.parse(raw) }
    } catch {
      // Missing or corrupt file -> keep defaults
    }
  }

  get store(): T {
    return this.data
  }

  set store(value: T) {
    this.data = { ...this.defaults, ...value }
    this.persist()
  }

  get<K extends keyof T>(key: K): T[K]
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K]
  get(key: keyof T, defaultValue?: T[keyof T]): T[keyof T] {
    const value = this.data[key]
    return value === undefined ? (defaultValue as T[keyof T]) : value
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.persist()
  }

  has(key: keyof T): boolean {
    return key in this.data
  }

  delete(key: keyof T): void {
    delete this.data[key]
    this.persist()
  }

  clear(): void {
    this.data = { ...this.defaults }
    this.persist()
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      const tmp = `${this.filePath}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
      fs.renameSync(tmp, this.filePath)
    } catch (error) {
      console.error(`Failed to persist store ${this.filePath}:`, error)
    }
  }
}
