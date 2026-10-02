import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import WebSocket from 'ws'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import type { AppRouter } from '../trpc/router'
import { DEV_API_PATH, DEV_HEALTH_PATH, DEV_MEDIA_PATH } from '../../shared/constants/development'
import { startDevGateway } from './gateway'

vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => '0.4.11' },
  BrowserWindow: {
    getAllWindows: () => {
      throw new Error('Browser requests must not control native windows')
    },
  },
  shell: {
    openExternal: () => {
      throw new Error('Browser requests must not open native links')
    },
  },
}))
vi.mock('electron-store', () => ({
  default: class {
    store: Record<string, unknown>
    defaults: Record<string, unknown>
    constructor(options: { defaults: Record<string, unknown> }) {
      this.defaults = structuredClone(options.defaults)
      this.store = structuredClone(options.defaults)
    }
    get(key: string) {
      return this.store[key]
    }
    set(key: string, value: unknown) {
      this.store[key] = value
    }
    clear() {
      this.store = structuredClone(this.defaults)
    }
  },
}))

const directory = await fs.mkdtemp(path.join(tmpdir(), 'lwe-gateway-'))
const token = 'a'.repeat(64)
const headers = { 'x-lwe-dev-token': token }
let gateway: Awaited<ReturnType<typeof startDevGateway>>
let wsClient: ReturnType<typeof createWSClient>
let client: ReturnType<typeof createTRPCClient<AppRouter>>
let baseUrl: string

beforeAll(async () => {
  vi.stubEnv('LWE_DEV_WEB', '1')
  vi.stubEnv('LWE_DEV_FIXTURES', '1')
  vi.stubEnv('LWE_DEV_DATA_DIR', directory)
  const { appRouter } = await import('../trpc/router')
  const { installFixtures } = await import('./fixtures')
  const { wallpaperService } = await import('../services/wallpaper/wallpaper')
  await installFixtures(directory)
  gateway = await startDevGateway({
    router: appRouter,
    token,
    catalog: async () => (await wallpaperService.query()).wallpapers,
  })
  baseUrl = `http://127.0.0.1:${gateway.port}`
  class AuthenticatedSocket extends WebSocket {
    constructor(url: string | URL) {
      super(url, { headers })
    }
  }
  wsClient = createWSClient({
    url: baseUrl.replace('http:', 'ws:') + DEV_API_PATH,
    WebSocket: AuthenticatedSocket as unknown as typeof globalThis.WebSocket,
  })
  client = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
})

afterAll(async () => {
  await wsClient?.close()
  await gateway?.close()
  vi.unstubAllEnvs()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('development gateway with real appRouter and fixture adapters', () => {
  it('serves health only to the owned proxy and rejects cross-origin requests', async () => {
    expect((await fetch(baseUrl + DEV_HEALTH_PATH)).status).toBe(403)
    expect((await fetch(baseUrl + DEV_HEALTH_PATH, { headers })).status).toBe(200)
    expect(
      (
        await fetch(baseUrl + DEV_HEALTH_PATH, {
          headers: {
            ...headers,
            origin: 'https://example.com',
            'x-lwe-dev-host': '127.0.0.1:1234',
          },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await fetch(baseUrl + DEV_HEALTH_PATH, {
          headers: { ...headers, 'sec-fetch-site': 'cross-site' },
        })
      ).status,
    ).toBe(403)
  })

  it('rejects DNS rebinding hosts at the gateway', async () => {
    expect(
      (
        await fetch(baseUrl + DEV_HEALTH_PATH, {
          headers: {
            ...headers,
            origin: 'http://attacker.example',
            'x-lwe-dev-host': 'attacker.example',
          },
        })
      ).status,
    ).toBe(403)
  })

  it('rejects unauthorized WebSocket upgrades', async () => {
    const socket = new WebSocket(baseUrl.replace('http:', 'ws:') + DEV_API_PATH)
    await expect(
      new Promise<number>((resolve, reject) => {
        socket.once('unexpected-response', (_request, response) => {
          response.resume()
          socket.terminate()
          resolve(response.statusCode ?? 0)
        })
        socket.once('open', () => {
          socket.close()
          reject(new Error('Unexpected unauthenticated connection'))
        })
        socket.on('error', () => {})
      }),
    ).resolves.toBe(403)
  })

  it('uses real settings validation, persists a mutation, and preserves desktop boundaries', async () => {
    expect(await client.health.query()).toEqual({ status: 'ok' })
    expect(await client.display.list.query()).toHaveLength(2)
    await client.settings.update.mutate({ volume: 37, launchOnLogin: true })
    expect((await client.settings.get.query()).volume).toBe(37)
    await expect(client.settings.update.mutate({ volume: 101 })).rejects.toThrow()
    expect(await client.window.maximize.mutate()).toEqual({ success: false })
    expect(await client.window.openExternal.mutate({ url: 'https://example.com' })).toEqual({
      success: false,
    })
    expect((await client.playlist.list.query())[0].name).toBe('Evening rotation')
  })

  it('delivers invalidation and Workshop observables, unsubscribes, and resubscribes after reconnect', async () => {
    const events: string[] = []
    const subscription = client.invalidation.onInvalidate.subscribe(undefined, {
      onData: (event) => events.push(event),
    })
    const connectionEvents: string[] = []
    const workshopSubscription = client.workshop.onConnectionEvent.subscribe(undefined, {
      onData: (event) => connectionEvents.push(event),
    })
    await vi.waitFor(() => expect(connectionEvents).toEqual(['disconnected']))
    const wallpapers = (await client.wallpaper.getWallpapers.query()).wallpapers
    const applied = await client.wallpaper.setWallpaper.mutate({
      backgroundId: wallpapers[0].path,
      screen: 'DP-1',
    })
    expect(applied.success).toBe(true)
    await vi.waitFor(() => expect(events).toContain('wallpaper.applied'))
    expect((await client.wallpaper.getActiveWallpaper.query())[0].title).toBe('Aurora Coast')
    wsClient.connection?.ws?.close()
    await vi.waitFor(() => expect(connectionEvents).toHaveLength(2), { timeout: 5000 })
    events.length = 0
    await client.wallpaper.stopWalpaper.mutate({ screen: 'DP-1' })
    await vi.waitFor(() => expect(events).toContain('wallpaper.stopped'))
    subscription.unsubscribe()
    workshopSubscription.unsubscribe()
    const { invalidationService } = await import('../services/invalidation')
    events.length = 0
    invalidationService.emit('display.list')
    expect(events).toEqual([])
    await expect(client.workshop.getItems.query({})).rejects.toThrow('Start Steam')
  })

  it('provides explicit empty and missing-backend fixture scenarios through the same router', async () => {
    const { installFixtures } = await import('./fixtures')
    vi.stubEnv('LWE_DEV_SCENARIO', 'empty')
    await installFixtures(directory)
    expect((await client.wallpaper.getWallpapers.query()).wallpapers).toEqual([])
    expect(await client.playlist.list.query()).toEqual([])
    vi.stubEnv('LWE_DEV_SCENARIO', 'missing-backend')
    await installFixtures(directory)
    expect((await client.wallpaper.getWallpapers.query()).wallpapers).toHaveLength(3)
    expect(await client.wallpaper.checkBackend.query()).toEqual({ installed: false })
    const wallpaper = (await client.wallpaper.getWallpapers.query()).wallpapers[0]
    expect(
      await client.wallpaper.setWallpaper.mutate({ backgroundId: wallpaper.path }),
    ).toMatchObject({ success: false })
    expect(await client.playlist.start.mutate({ playlistName: 'Evening rotation' })).toMatchObject({
      success: false,
    })
    expect(await client.wallpaper.getActiveWallpaper.query()).toEqual([])
    expect(await client.playlist.active.query()).toEqual([])
    vi.stubEnv('LWE_DEV_SCENARIO', 'populated')
    await installFixtures(directory)
  })

  it('streams advertised media with MIME, HEAD and byte ranges and blocks escape paths', async () => {
    const wallpaper = (await client.wallpaper.getWallpapers.query()).wallpapers[0]
    const url = baseUrl + DEV_MEDIA_PATH + '?path=' + encodeURIComponent(wallpaper.thumbnail)
    const response = await fetch(url, { headers })
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    const body = await response.text()
    expect(body).toContain('<svg')
    expect((await fetch(url, { method: 'HEAD', headers })).headers.get('content-length')).toBe(
      String(Buffer.byteLength(body)),
    )
    const range = await fetch(url, { headers: { ...headers, range: 'bytes=0-3' } })
    expect(range.status).toBe(206)
    expect(await range.text()).toBe('<svg')
    const suffix = await fetch(url, { headers: { ...headers, range: 'bytes=-6' } })
    expect(await suffix.text()).toBe('</svg>')
    expect((await fetch(url, { headers: { ...headers, range: 'bytes=999999-' } })).status).toBe(416)
    expect((await fetch(url, { headers: { ...headers, range: 'bytes=0-1,3-4' } })).status).toBe(416)
    expect(
      (
        await fetch(baseUrl + DEV_MEDIA_PATH + '?path=' + encodeURIComponent('/etc/passwd'), {
          headers,
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await fetch(
          baseUrl +
            DEV_MEDIA_PATH +
            '?path=' +
            encodeURIComponent(path.join(wallpaper.path, 'project.json')),
          { headers },
        )
      ).status,
    ).toBe(403)
    const outside = path.join(directory, 'outside.svg')
    await fs.writeFile(outside, 'private')
    await fs.unlink(wallpaper.thumbnail)
    await fs.symlink(outside, wallpaper.thumbnail)
    expect((await fetch(url, { headers })).status).toBe(403)
  })

  it('closes listener and connections without leaving subscriptions alive', async () => {
    await wsClient.close()
    await gateway.close()
    await expect(fetch(baseUrl + DEV_HEALTH_PATH, { headers })).rejects.toThrow()
    await gateway.close()
  })
})
