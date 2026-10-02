import http from 'node:http'
import { WebSocketServer } from 'ws'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import type { AppRouter } from '../trpc/router'
import { createTrpcContext } from '../trpc/context'
import type { Wallpaper } from '../../shared/constants/wallpaper'
import { DEV_API_PATH, DEV_HEALTH_PATH, DEV_MEDIA_PATH } from '../../shared/constants/development'
import { serveMedia } from './media'

export async function startDevGateway(options: {
  router: AppRouter
  token: string
  catalog: () => Promise<Wallpaper[]>
}) {
  if (options.token.length < 32) throw new Error('A private development proxy token is required')
  const authorized = (req: http.IncomingMessage) => {
    if (req.headers['x-lwe-dev-token'] !== options.token) return false
    if (req.headers['sec-fetch-site'] === 'cross-site') return false
    const forwardedHost = req.headers['x-lwe-dev-host']
    if (forwardedHost !== undefined) {
      if (typeof forwardedHost !== 'string') return false
      try {
        const host = new URL(`http://${forwardedHost}`).hostname
        if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return false
      } catch {
        return false
      }
    }
    const origin = req.headers.origin
    if (origin) {
      try {
        const url = new URL(origin)
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.host !== req.headers['x-lwe-dev-host']
        )
          return false
      } catch {
        return false
      }
    }
    return true
  }
  const server = http.createServer((req, res) => {
    if (!authorized(req)) {
      res.writeHead(403).end()
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname === DEV_HEALTH_PATH) {
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (pathname === DEV_MEDIA_PATH) {
      void serveMedia(req, res, options.catalog).catch(() => {
        if (!res.headersSent) res.writeHead(500).end()
        else res.destroy()
      })
      return
    }
    res.writeHead(404).end()
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
  const handler = applyWSSHandler({
    wss,
    router: options.router,
    createContext: () => createTrpcContext(),
    keepAlive: { enabled: true, pingMs: 30000, pongWaitMs: 5000 },
  })
  server.on('upgrade', (req, socket, head) => {
    if (!authorized(req) || req.url !== DEV_API_PATH) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Gateway did not bind a TCP port')
  let closing: Promise<void> | undefined
  return {
    port: address.port,
    close() {
      return (closing ??= (async () => {
        handler.broadcastReconnectNotification()
        for (const client of wss.clients) client.terminate()
        await new Promise<void>((resolve) => wss.close(() => resolve()))
        server.closeAllConnections()
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
      })())
    },
  }
}
