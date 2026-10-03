import type { Server } from 'node:http'
import { WebSocket } from 'ws'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DEV_GATEWAY_TOKEN_HEADER } from '../../shared/constants/development'

vi.mock('../trpc/router.ts', async () => {
  const { initTRPC } = await import('@trpc/server')
  const trpc = initTRPC.create()
  return { appRouter: trpc.router({ health: trpc.procedure.query(() => 'ready') }) }
})
vi.mock('../trpc/context.ts', () => ({ createTrpcContext: () => ({}) }))
vi.mock('./media.ts', () => ({
  serveMedia: async (_req: unknown, res: { end: (body: string) => void }) => {
    res.end('preview')
  },
}))
import { startDevGateway } from './gateway'

const servers: Server[] = []
const origin = 'http://localhost:5173'
async function start(token = 'first-session') {
  const server = await startDevGateway(origin, { port: 0, token })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing gateway address')
  return { port: address.port, url: `http://127.0.0.1:${address.port}` }
}
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  )
})

function connect(url: string, token: string, connectionOrigin = origin): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${url.replace('http:', 'ws:')}/api/trpc`, {
      origin: connectionOrigin,
      headers: { [DEV_GATEWAY_TOKEN_HEADER]: token },
    })
    socket.on('error', reject)
    socket.once('open', () => {
      socket.once('close', () => resolve(101))
      socket.close()
    })
    socket.once('unexpected-response', (_request, response) => {
      response.resume()
      socket.terminate()
      resolve(response.statusCode ?? 0)
    })
  })
}

describe('development gateway isolation', () => {
  it('allows media requests only through the matching proxy session', async () => {
    const { url } = await start()
    const response = await fetch(`${url}/api/media`, {
      headers: { [DEV_GATEWAY_TOKEN_HEADER]: 'first-session' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('preview')
    expect((await fetch(`${url}/api/media`)).status).toBe(403)
    expect(
      (
        await fetch(`${url}/api/media`, {
          headers: { [DEV_GATEWAY_TOKEN_HEADER]: 'second-session' },
        })
      ).status,
    ).toBe(403)
  })
  it('requires both the expected browser origin and proxy session for WebSockets', async () => {
    const { url } = await start()
    expect(await connect(url, 'first-session')).toBe(101)
    expect(await connect(url, 'second-session')).toBe(403)
    expect(await connect(url, 'first-session', 'http://localhost:5174')).toBe(403)
    expect(await connect(url, 'first-session', 'https://unrelated.example')).toBe(403)
  })
  it('rejects a second backend on an occupied port and prevents its proxy from using the first backend', async () => {
    const { url, port } = await start()
    await expect(startDevGateway(origin, { port, token: 'second-session' })).rejects.toMatchObject({
      code: 'EADDRINUSE',
    })
    expect(
      (
        await fetch(`${url}/api/media`, {
          headers: { [DEV_GATEWAY_TOKEN_HEADER]: 'second-session' },
        })
      ).status,
    ).toBe(403)
    expect(await connect(url, 'second-session')).toBe(403)
  })
})
