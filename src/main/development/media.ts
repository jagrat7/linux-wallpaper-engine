import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { wallpaperService } from '../services/wallpaper/wallpaper.ts'

const mimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

// Only advertised previews inside their wallpaper directory may be served.
export async function serveMedia(req: IncomingMessage, res: ServerResponse) {
  const requested = new URL(req.url ?? '', 'http://localhost').searchParams.get('path')
  if (!requested) {
    res.writeHead(400).end()
    return
  }
  const requestedPath = path.resolve(requested)
  const file = await fs.realpath(requestedPath).catch(() => null)
  if (!file) {
    res.writeHead(404).end()
    return
  }
  const wallpapers = await wallpaperService.catalog()
  const wallpaper = wallpapers.find((item) =>
    [item.thumbnail, item.previewUrl].some(
      (preview) => preview && path.resolve(preview) === requestedPath,
    ),
  )
  if (!wallpaper) {
    res.writeHead(403).end()
    return
  }
  const directory = await fs.realpath(wallpaper.path).catch(() => null)
  if (!directory) {
    res.writeHead(404).end()
    return
  }
  if (!file.startsWith(directory + path.sep)) {
    res.writeHead(403).end()
    return
  }
  const stat = await fs.stat(file).catch(() => null)
  if (!stat?.isFile()) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
  })
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res)
}
