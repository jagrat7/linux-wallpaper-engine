import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Wallpaper } from '../../shared/constants/wallpaper'

const mimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avif': 'image/avif',
}

const inside = (root: string, file: string) => {
  const relative = path.relative(root, file)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

export async function serveMedia(
  req: IncomingMessage,
  res: ServerResponse,
  catalog: () => Promise<Wallpaper[]>,
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  const requested = new URL(req.url ?? '', 'http://localhost').searchParams.get('path')
  if (!requested || !path.isAbsolute(requested)) {
    res.writeHead(400).end()
    return
  }
  const mime = mimeTypes[path.extname(requested).toLowerCase()]
  if (!mime) {
    res.writeHead(403).end()
    return
  }
  const wallpapers = await catalog()
  // Only advertised thumbnail/preview files are eligible, under their wallpaper root.
  const wallpaper = wallpapers.find(
    (item) =>
      (item.thumbnail === requested || item.previewUrl === requested) &&
      inside(path.resolve(item.path), path.resolve(requested)),
  )
  if (!wallpaper) {
    res.writeHead(403).end()
    return
  }
  try {
    const [root, file] = await Promise.all([fs.realpath(wallpaper.path), fs.realpath(requested)])
    if (!inside(root, file)) {
      res.writeHead(403).end()
      return
    }
    const stat = await fs.stat(file)
    if (!stat.isFile()) {
      res.writeHead(404).end()
      return
    }
    let start = 0
    let end = stat.size - 1
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end()
        return
      }
      if (match[1]) {
        start = Number(match[1])
        end = match[2] ? Math.min(Number(match[2]), end) : end
      } else {
        start = Math.max(0, stat.size - Number(match[2]))
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= stat.size ||
        stat.size === 0
      ) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end()
        return
      }
    }
    res.writeHead(req.headers.range ? 206 : 200, {
      'Content-Type': mime,
      'Content-Length': Math.max(0, end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      ...(req.headers.range ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}),
    })
    if (req.method === 'HEAD' || stat.size === 0) {
      res.end()
      return
    }
    const stream = createReadStream(file, { start, end })
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  } catch {
    if (!res.headersSent) res.writeHead(404).end()
    else res.destroy()
  }
}
