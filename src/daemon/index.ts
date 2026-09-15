import { appRouter } from '../main/trpc/router'
import { createTrpcContext } from '../main/trpc/context'
import { settingsService } from '../main/services/settings'
import { systemThemeService } from '../main/services/system-theme/system-theme'
import { invalidationService } from '../main/services/invalidation'
import { displayService } from '../main/services/display'
import { setFlatpakBypass } from '../main/utils/host'
import { setAutostart } from '../main/utils/autostart'
import { createDaemonPlatform } from './platform-theme'

const PORT = Number(process.env.LWE_PORT ?? 48734)
const encoder = new TextEncoder()

// ── Boot wiring (mirrors src/main/main.ts, minus window/tray) ────────────
setFlatpakBypass(settingsService.getSetting('flatpakBypass'))
setAutostart(settingsService.getSetting('launchOnLogin'))
systemThemeService.configurePlatform(createDaemonPlatform())

const caller = appRouter.createCaller(createTrpcContext())

// Procedures exposed as subscriptions over /events instead of /rpc
const SUBSCRIPTION_PATHS = new Set([
  'invalidation.onInvalidate',
  'workshop.onConnectionEvent',
])

type Caller = typeof caller

const resolveProcedure = (procPath: string): ((input?: unknown) => Promise<unknown>) => {
  const node = procPath.split('.').reduce<unknown>((obj, key) => {
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return undefined
    return (obj as Record<string, unknown>)[key]
  }, caller as unknown)
  if (typeof node !== 'function') {
    throw Object.assign(new Error(`Unknown procedure: ${procPath}`), { code: 'NOT_FOUND' })
  }
  return node as (input?: unknown) => Promise<unknown>
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const handleRpc = async (req: Request): Promise<Response> => {
  let procPath: string
  let input: unknown
  let hasInput: boolean
  try {
    const body = await req.json() as { path?: string; input?: unknown }
    if (typeof body?.path !== 'string') throw new Error('Missing "path"')
    procPath = body.path
    hasInput = 'input' in body
    input = body.input
  } catch {
    return json({ error: { code: 'BAD_REQUEST', message: 'Body must be JSON: { "path": string, "input"?: any }' } }, 400)
  }

  if (SUBSCRIPTION_PATHS.has(procPath)) {
    return json({ error: { code: 'BAD_REQUEST', message: 'Subscriptions are delivered over GET /events' } }, 400)
  }

  try {
    const fn = resolveProcedure(procPath)
    const result = await fn(hasInput ? input : undefined)
    return json({ result: result ?? null })
  } catch (error) {
    const err = error as { message?: string; code?: string }
    console.error(`[rpc] ${procPath} failed:`, error)
    return json({
      error: {
        code: err.code ?? 'INTERNAL_SERVER_ERROR',
        message: err.message ?? 'Internal error',
      },
    }, 500)
  }
}

const openSubscription = async (procPath: string, onData: (data: unknown) => void) => {
  const fn = resolveProcedure(procPath)
  const observable = await fn(undefined) as { subscribe: (observer: { next: (d: unknown) => void }) => { unsubscribe: () => void } }
  return observable.subscribe({ next: onData })
}

// ── Long-poll event channel ──────────────────────────────────────────────
// QML's XMLHttpRequest can't read streaming responses, so instead of SSE we
// buffer daemon events in a ring and let clients poll: GET /events/poll
// returns immediately when there are events newer than `since`, otherwise
// holds the request open until one arrives or the wait times out.

interface DaemonEvent { seq: number; type: string; data: unknown }

const EVENT_BUFFER_SIZE = 200
const eventBuffer: DaemonEvent[] = []
let eventSeq = 0
const waiters: Array<{ since: number; resolve: (events: DaemonEvent[]) => void }> = []

const pushEvent = (type: string, data: unknown) => {
  eventBuffer.push({ seq: ++eventSeq, type, data })
  if (eventBuffer.length > EVENT_BUFFER_SIZE) eventBuffer.shift()
  const pending = waiters.splice(0)
  for (const waiter of pending) waiter.resolve(eventsSince(waiter.since))
}

const eventsSince = (since: number): DaemonEvent[] =>
  eventBuffer.filter(e => e.seq > since)

const handleEventPoll = async (url: URL): Promise<Response> => {
  const since = Number(url.searchParams.get('since') ?? 0) || 0
  const waitMs = Math.min(Number(url.searchParams.get('wait') ?? 25_000) || 25_000, 60_000)

  const buffered = eventsSince(since)
  if (buffered.length > 0) {
    return json({ events: buffered, latest: eventSeq })
  }

  const events = await new Promise<DaemonEvent[]>(resolve => {
    const waiter = { since, resolve }
    waiters.push(waiter)
    setTimeout(() => {
      const idx = waiters.indexOf(waiter)
      if (idx >= 0) {
        waiters.splice(idx, 1)
        resolve([])
      }
    }, waitMs)
  })
  return json({ events, latest: eventSeq })
}

void openSubscription('invalidation.onInvalidate', data => pushEvent('invalidation', data))
  .then(() => console.log('[events] invalidation subscription active'))
  .catch(error => console.error('invalidation subscription failed:', error))
void openSubscription('workshop.onConnectionEvent', data => pushEvent('workshop-connection', data))
  .then(() => console.log('[events] workshop subscription active'))
  .catch(error => console.error('workshop subscription failed:', error))

const handleEvents = (): Response => {
  let heartbeat: ReturnType<typeof setInterval> | null = null
  const subscriptions: Array<{ unsubscribe: () => void }> = []

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client disconnected mid-write
        }
      }

      void openSubscription('invalidation.onInvalidate', data => send('invalidation', data))
        .then(sub => subscriptions.push(sub))
        .catch(error => send('stream-error', { message: String(error) }))
      void openSubscription('workshop.onConnectionEvent', data => send('workshop-connection', data))
        .then(sub => subscriptions.push(sub))
        .catch(error => send('stream-error', { message: String(error) }))

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          // disconnected
        }
      }, 15_000)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      subscriptions.forEach(sub => sub.unsubscribe())
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// Poll displays and emit display.list invalidations when the set changes —
// replaces Electron's `screen` events.
let lastDisplaySignature = ''
const pollDisplays = async () => {
  try {
    const displays = await displayService.detectDisplays()
    const signature = JSON.stringify(displays.map(d => [d.name, d.width, d.height, d.x, d.y]))
    if (lastDisplaySignature && signature !== lastDisplaySignature) {
      invalidationService.emit('display.list')
    }
    lastDisplaySignature = signature
  } catch {
    // detection failed this tick; retry next interval
  }
}
setInterval(pollDisplays, 10_000).unref()
void pollDisplays()

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/health') return json({ status: 'ok', version: 1 })
    if (url.pathname === '/events/poll' && req.method === 'GET') return handleEventPoll(url)
    if (url.pathname === '/events' && req.method === 'GET') return handleEvents()
    if (url.pathname === '/rpc' && req.method === 'POST') return handleRpc(req)
    return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404)
  },
})

console.log(`lwe-daemon listening on http://127.0.0.1:${server.port}`)

const shutdown = () => {
  systemThemeService.stopWatching()
  server.stop(true)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
