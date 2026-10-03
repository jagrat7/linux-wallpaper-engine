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

// Streams a file only if it lives inside an installed wallpaper's directory
export async function serveMedia(req: IncomingMessage, res: ServerResponse) {
  const requested = new URL(req.url ?? '', 'http://localhost').searchParams.get('path')
  if (!requested) {
    res.writeHead(400).end()
    return
  }
  const file = await fs.realpath(path.resolve(requested)).catch(() => null)
  if (!file) {
    res.writeHead(404).end()
    return
  }
  const wallpapers = await wallpaperService.catalog()
  const directories = await Promise.all(
    wallpapers.map((item) => fs.realpath(item.path).catch(() => null)),
  )
  const known = directories.some((directory) => directory && file.startsWith(directory + path.sep))
  if (!known) {
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
