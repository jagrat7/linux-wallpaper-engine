import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Wallpaper } from '../../shared/constants/wallpaper'

const catalog = vi.hoisted(() => vi.fn())
vi.mock('../services/wallpaper/wallpaper.ts', () => ({ wallpaperService: { catalog } }))
import { serveMedia } from './media'

const root = await fs.mkdtemp(path.join(tmpdir(), 'lwe-media-test-'))
const directory = path.join(root, 'wallpaper')
await fs.mkdir(directory)
await fs.writeFile(path.join(directory, 'preview.png'), 'preview')
await fs.writeFile(path.join(directory, 'project.json'), 'unadvertised')
await fs.writeFile(path.join(root, 'outside.png'), 'outside')
await fs.symlink(path.join(root, 'outside.png'), path.join(directory, 'escape.png'))
await fs.symlink(path.join(directory, 'preview.png'), path.join(directory, 'inside.png'))
const server = http.createServer((req, res) => {
  void serveMedia(req, res).catch(() => res.writeHead(500).end())
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Missing server address')
const baseUrl = `http://127.0.0.1:${address.port}/api/media`
const request = (file: string) => fetch(`${baseUrl}?path=${encodeURIComponent(file)}`)
const makeWallpaper = (preview = 'preview.png'): Wallpaper => ({
  id: '123',
  title: 'Test',
  author: 'Test',
  type: 'scene',
  thumbnail: path.join(directory, preview),
  previewUrl: path.join(directory, preview),
  resolution: { width: 0, height: 0 },
  fileSize: 0,
  dateAdded: 0,
  tags: [],
  installed: true,
  path: directory,
})
beforeEach(() => {
  catalog.mockClear()
  catalog.mockResolvedValue([makeWallpaper()])
})
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await fs.rm(root, { recursive: true, force: true })
})

describe('development preview media', () => {
  it('returns 404 for a missing preview without scanning the catalog', async () => {
    expect((await request(path.join(directory, 'missing.png'))).status).toBe(404)
    expect(catalog).not.toHaveBeenCalled()
  })
  it('serves an advertised preview', async () => {
    const response = await request(path.join(directory, 'preview.png'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await response.text()).toBe('preview')
  })
  it('rejects unadvertised files inside a wallpaper directory', async () => {
    expect((await request(path.join(directory, 'project.json'))).status).toBe(403)
  })
  it('rejects an advertised symlink escaping its wallpaper directory', async () => {
    catalog.mockResolvedValue([makeWallpaper('escape.png')])
    expect((await request(path.join(directory, 'escape.png'))).status).toBe(403)
  })
  it('allows advertised symlinks that stay inside the wallpaper directory', async () => {
    catalog.mockResolvedValue([makeWallpaper('inside.png')])
    const response = await request(path.join(directory, 'inside.png'))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('preview')
  })
  it('does not authorize an outside file merely because it has the same preview name', async () => {
    expect((await request(path.join(root, 'outside.png'))).status).toBe(403)
  })
})
