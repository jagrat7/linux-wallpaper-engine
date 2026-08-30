import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ChildProcess } from 'node:child_process'
import { CACHE_TTL, STEAM_ROOT_PATHS, type AppSettings } from '../../../shared/constants/app'
import type { ApplyWallpaperOptions, Wallpaper, WallpaperType } from '../../../shared/constants/wallpaper'
import { hostExecAsync } from '../../utils/host'

type ImageType = "jpeg" | "png" | "bmp"
export type TimedCache<T> = {
  value: T
  timestamp: number
  key?: string
}

const IMAGE_HEADERS_IDENTIFIERS = {
  jpeg: 0xffd8,
  png: 0x89504e47,
  bmp: 0x424d,
};
const MAX_BYTES = 8192;
const WINDOW_SIZE_PATTERN = /^(\d+)x(\d+)$/
let steamLibraryPathsCache: TimedCache<string[]> | null = null

export async function resolveTimedCache<T>(
  cache: TimedCache<T> | null,
  load: () => Promise<T>,
  key?: string,
): Promise<TimedCache<T>> {
  if (cache && (!key || cache.key === key) && (Date.now() - cache.timestamp) <= CACHE_TTL) {
    return cache
  }

  return {
    value: await load(),
    timestamp: Date.now(),
    key,
  }
}

export const parseWindowGeometry = (size: string | null | undefined): ApplyWallpaperOptions['windowed'] => {
  const match = size?.trim().match(WINDOW_SIZE_PATTERN)
  if (!match) return 'emit-flag'

  const [, width, height] = match
  const parsed = {
    x: 0,
    y: 0,
    width: Number(width),
    height: Number(height),
  }

  if (parsed.width <= 0 || parsed.height <= 0) return 'emit-flag'

  return parsed
}

// Merge global settings (and optional per-call input overrides) into backend
// apply options. Shared by the setWallpaper tRPC route and random applies.
export const buildApplyOptions = (
  settings: AppSettings,
  input?: Partial<ApplyWallpaperOptions>,
): ApplyWallpaperOptions => ({
  backgroundId: input?.backgroundId ?? '',
  screen: input?.screen,
  scaling: input?.scaling ?? settings.defaultScaling,
  fps: input?.fps ?? settings.fps,
  volume: input?.volume ?? settings.volume,
  silent: input?.silent ?? settings.silent,
  noAutomute: input?.noAutomute ?? settings.noAutomute,
  noAudioProcessing: input?.noAudioProcessing ?? !settings.audioProcessing,
  disableMouse: input?.disableMouse ?? settings.disableMouse,
  disableParallax: input?.disableParallax ?? settings.disableParallax,
  disableParticles: input?.disableParticles ?? settings.disableParticles,
  noFullscreenPause: input?.noFullscreenPause ?? !settings.pauseOnFullscreen,
  windowed: settings.windowMode ? parseWindowGeometry(settings.windowGeometry) : input?.windowed,
})

// Pick a random wallpaper, preferring ones that aren't currently applied.
// Falls back to the full list when everything is already active.
export const pickRandomWallpaper = (wallpapers: Wallpaper[], activeIds: ReadonlySet<string>): Wallpaper => {
  const unused = wallpapers.filter(w => !activeIds.has(w.path))
  const pool = unused.length > 0 ? unused : wallpapers
  return pool[Math.floor(Math.random() * pool.length)]
}

// pgrep/pkill pattern matching the backend process driving a screen. The
// 'default' screen key is app-level window mode, where no --screen-root flag
// is passed and only one process exists.
export const screenProcessPattern = (screen: string): string =>
  screen === 'default'
    ? 'linux-wallpaperengine'
    : `"linux-wallpaperengine.*--screen-root.*${screen}"`

// Deliver SIGSTOP/SIGCONT to the backend process driving a screen. Prefers the
// tracked child-process handle and falls back to pkill when the handle was
// lost (e.g. state restored after an app restart). Returns whether the signal
// was actually delivered — kill() reports failure by returning false rather
// than throwing.
export const signalWallpaperProcess = async (
  screen: string,
  signal: 'SIGSTOP' | 'SIGCONT',
  proc: ChildProcess | undefined,
): Promise<boolean> => {
  if (proc) {
    try {
      return proc.kill(signal)
    } catch {
      return false
    }
  }
  const flag = signal === 'SIGSTOP' ? 'STOP' : 'CONT'
  try {
    await hostExecAsync(`pkill -${flag} -f ${screenProcessPattern(screen)}`)
    return true
  } catch {
    return false
  }
}

export async function parseImageHeader(imagePath: string) {
  try {
    const file = await fs.open(imagePath, "r");
    const buffer = Buffer.alloc(8192); // 8kb
    const { bytesRead } = await file.read(buffer, 0, MAX_BYTES, 0);
    await file.close();

    const res = { height: 0, width: 0 };

    if (matchHeader(buffer, "png")) {
      // https://en.wikipedia.org/wiki/PNG#Examples
      const widthOffset = 16;
      const heightOffset = widthOffset + 4;
      res.width = buffer.readUInt32BE(widthOffset);
      res.height = buffer.readUInt32BE(heightOffset);
    } else if (matchHeader(buffer, "bmp")) {
      // BMP uses little endian
      const widthOffset = 18;
      const heightOffset = widthOffset + 4;
      res.width = buffer.readUInt32LE(widthOffset);
      res.height = buffer.readUInt32LE(heightOffset);
    } else if (matchHeader(buffer, "jpeg")) {
      // https://stackoverflow.com/questions/14414884
      let offset = 2;
      while (offset < bytesRead - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];

        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker)
        ) {
          const heightOffset = offset + 5;
          const widthOffset = heightOffset + 2;
          res.height = buffer.readUInt16BE(heightOffset);
          res.width = buffer.readUInt16BE(widthOffset);
          break;
        }
        offset += 2 + buffer.readUInt16BE(offset + 2); // 2 + length segment, +2 so we skip the marker
      }
    }

    return res;
  } catch (err) {
    return { height: 0, width: 0 };
  }
}

function matchHeader(buffer: Buffer, imageType: ImageType) {
  switch (imageType) {
    case "jpeg":
      return buffer.readUInt16BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType]

    case "png":
      return buffer.readUInt32BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType]

    case "bmp":
      return buffer.readUInt16BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType]
  }
}

export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(process.env.HOME ?? '', p.slice(1))
  }
  return p
}

export async function resolveSteamLibraryPaths(basePaths = STEAM_ROOT_PATHS): Promise<string[]> {
  steamLibraryPathsCache = await resolveTimedCache(steamLibraryPathsCache, async () => {
    const libraries = new Set<string>()

    for (const basePath of basePaths) {
      const expanded = expandPath(basePath)
      libraries.add(expanded)

      const libraryFoldersPath = path.join(expanded, 'steamapps/libraryfolders.vdf')
      try {
        const data = await fs.readFile(libraryFoldersPath, 'utf-8')
        const matches = data.matchAll(/"path"\s+"([^"]+)"/g)
        for (const match of matches) {
          libraries.add(match[1].replace(/\\\\/g, '\\'))
        }
      } catch { /* path may not be a Steam root */ }
    }

    return [...libraries]
  }, basePaths.join('\0'))

  return steamLibraryPathsCache.value
}

export async function resolveWallpaperEngineAssetsDir(basePaths?: string[]): Promise<string | null> {
  const steamLibraryPaths = await resolveSteamLibraryPaths(basePaths)

  for (const steamLibraryPath of steamLibraryPaths) {
    const assetsDir = path.join(steamLibraryPath, 'steamapps/common/wallpaper_engine/assets')
    try {
      await fs.access(assetsDir)
      return assetsDir
    } catch { /* path doesn't exist */ }
  }

  return null
}

export function parseWallpaperType(rawType?: string): WallpaperType {
  if (!rawType) return 'scene'
  const typeMap: Record<string, WallpaperType> = {
    scene: 'scene',
    video: 'video',
    web: 'web',
    application: 'application',
  }
  return typeMap[rawType.toLowerCase()] ?? 'scene'
}

const PREVIEW_CANDIDATES = ['preview.jpg', 'preview.png', 'preview.gif']

export async function resolveThumbnail(backgroundId: string): Promise<string> {
  try {
    const projectPath = path.join(backgroundId, 'project.json')
    const projectData = await fs.readFile(projectPath, 'utf-8')
    const project = JSON.parse(projectData)
    if (project.preview) {
      return path.join(backgroundId, project.preview)
    }
  } catch {
    // Fallback: try common preview filenames
    for (const candidate of PREVIEW_CANDIDATES) {
      const candidatePath = path.join(backgroundId, candidate)
      try {
        await fs.access(candidatePath)
        return candidatePath
      } catch { /* continue */ }
    }
  }
  return ''
}

export async function detectResolution(wallpaperPath: string): Promise<{ width: number, height: number }> {
  try {
    const files = await fs.readdir(wallpaperPath)

    // Look for video files first
    const videoFile = files.find(f => {
      const file = f.toLowerCase()
      return file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.avi') || file.endsWith('.mkv')
    })

    if (videoFile) {
      const videoPath = path.join(wallpaperPath, videoFile)
      const { stdout } = await hostExecAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`)
      const [w, h] = stdout.trim().split(',')
      if (w && h) {
        return { width: parseInt(w, 10), height: parseInt(h, 10) }
      }
    } else {
      // Look for image files (excluding preview thumbnails)
      const imageFile = files.find(f => {
        const file = f.toLowerCase()
        return (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.bmp')) &&
          !file.includes('preview')
      })

      if (imageFile) {
        const imagePath = path.join(wallpaperPath, imageFile)
        const { stdout } = await hostExecAsync(`file "${imagePath}"`)
        const match = stdout.match(/(\d+)\s*x\s*(\d+)/)
        if (match) {
          return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) }
        }
        return parseImageHeader(imagePath)
      }
    }
  } catch {
    // Keep 0x0 if detection fails
  }

  return { width: 0, height: 0 }
}
