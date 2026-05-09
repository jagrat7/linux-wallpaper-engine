import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ApplyWallpaperOptions, WallpaperType } from '../../../shared/constants/wallpaper'
import { hostExecAsync } from '../../utils/host'

type ImageType = "jpeg" | "png" | "bmp"

const IMAGE_HEADERS_IDENTIFIERS = {
  jpeg: 0xffd8,
  png: 0x89504e47,
  bmp: 0x424d,
};
const MAX_BYTES = 8192;
const WINDOW_SIZE_PATTERN = /^(\d+)x(\d+)$/
const STEAM_ROOT_PATHS = [
  '~/.local/share/Steam',
  '~/.steam/steam',
  '~/.var/app/com.valvesoftware.Steam/.local/share/Steam',
  '~/.var/app/com.valvesoftware.Steam/.data/Steam',
  '~/.var/app/com.valvesoftware.Steam/.steam/steam',
]

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
