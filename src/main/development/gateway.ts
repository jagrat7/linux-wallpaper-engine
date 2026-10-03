import http from 'node:http'
import { WebSocketServer } from 'ws'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { appRouter } from '../trpc/router.ts'
import { createTrpcContext } from '../trpc/context.ts'
import {
  DEV_API_PATH,
  DEV_BACKEND_PORT,
  DEV_MEDIA_PATH,
  DEV_GATEWAY_TOKEN_ENV,
  DEV_GATEWAY_TOKEN_HEADER,
} from '../../shared/constants/development.ts'
import { serveMedia } from './media.ts'

// Dev only: lets the renderer dev server opened in a browser tab use this backend.
// Serves the tRPC router over WebSocket and wallpaper media over HTTP.
export async function startDevGateway(
  devServerUrl: string,
  {
    port = DEV_BACKEND_PORT,
    token = process.env[DEV_GATEWAY_TOKEN_ENV],
  }: { port?: number; token?: string } = {},
) {
  if (!token) throw new Error('Browser development backend session token is missing')
  const allowedOrigin = new URL(devServerUrl).origin
  const server = http.createServer((req, res) => {
    if (req.headers[DEV_GATEWAY_TOKEN_HEADER] !== token) {
      res.writeHead(403).end()
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname !== DEV_MEDIA_PATH) {
      res.writeHead(404).end()
      return
    }
    void serveMedia(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end()
      else res.destroy()
    })
  })
  const wss = new WebSocketServer({ noServer: true, path: DEV_API_PATH })
  server.on('upgrade', (req, socket, head) => {
    if (req.headers.origin !== allowedOrigin || req.headers[DEV_GATEWAY_TOKEN_HEADER] !== token) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })
  applyWSSHandler({ wss, router: appRouter, createContext: () => createTrpcContext() })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
  } catch (error) {
    wss.close()
    server.close()
    throw error
  }
  server.on('close', () => wss.close())
  return server
}
