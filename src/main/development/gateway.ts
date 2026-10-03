import http from 'node:http'
import { WebSocketServer } from 'ws'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { appRouter } from '../trpc/router.ts'
import { createTrpcContext } from '../trpc/context.ts'
import {
  DEV_API_PATH,
  DEV_BACKEND_PORT,
  DEV_MEDIA_PATH,
} from '../../shared/constants/development.ts'
import { serveMedia } from './media.ts'

// Dev only: lets the renderer dev server opened in a browser tab use this backend.
// Serves the tRPC router over WebSocket and wallpaper media over HTTP.
export async function startDevGateway() {
  const server = http.createServer((req, res) => {
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
  const wss = new WebSocketServer({ server, path: DEV_API_PATH })
  applyWSSHandler({ wss, router: appRouter, createContext: () => createTrpcContext() })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(DEV_BACKEND_PORT, '127.0.0.1', resolve)
  })
}
