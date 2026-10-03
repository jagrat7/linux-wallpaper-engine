import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire, builtinModules } from 'node:module'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { build, createServer, type ViteDevServer } from 'vite-plus'
import {
  DEV_READY_PREFIX,
  DEV_HEALTH_PATH,
  DEV_WEB_READY_PREFIX,
  type DevWebReady,
} from '../src/shared/constants/development.ts'
import { stopOwnedProcess } from './dev-process.ts'
import { createRunDirectory, pruneRuns, runCacheDirectory } from './dev-runtime.ts'

// This command owns a development environment. Vite build otherwise initializes
// an unset NODE_ENV to production, causing the subsequent server to skip refresh.
process.env.NODE_ENV = 'development'
const root = process.cwd()
const worktreeId = createHash('sha256')
  .update(await fs.realpath(root))
  .digest('hex')
  .slice(0, 12)
const fixtureMode = process.argv.includes('--fixtures')
const scenario =
  process.argv.find((argument) => argument.startsWith('--scenario='))?.split('=')[1] ?? 'populated'
if (!['populated', 'empty', 'missing-backend'].includes(scenario))
  throw new Error(`Unknown scenario: ${scenario}`)
if (!fixtureMode && scenario !== 'populated') throw new Error('--scenario requires --fixtures')
const worktreeDirectory = path.resolve(root, '.dev-runtime', worktreeId)
const runsDirectory = path.join(worktreeDirectory, 'runs')
const runDirectory = await createRunDirectory(runsDirectory)
const cacheDirectory = runCacheDirectory(runDirectory)
const dataDirectory = fixtureMode
  ? path.join(runDirectory, 'data')
  : path.join(worktreeDirectory, 'web')
const buildDirectory = path.join(runDirectory, 'backend')
const token = randomBytes(32).toString('hex')
const require = createRequire(import.meta.url)
const electron: string = require('electron')
let child: ReturnType<typeof spawn> | undefined
let frontend: ViteDevServer | undefined
let shuttingDown = false

async function cleanup() {
  if (shuttingDown) return
  shuttingDown = true
  await Promise.all([frontend?.close(), child ? stopOwnedProcess(child) : undefined])
  // The dependency cache is most of a run; the backend bundle and data stay for inspection.
  await fs.rm(cacheDirectory, { recursive: true, force: true })
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void cleanup().then(() => process.exit(0))
  })

try {
  await fs.mkdir(dataDirectory, { recursive: true })
  await pruneRuns(runsDirectory, runDirectory).catch((error: unknown) => {
    console.warn('Could not prune finished development runs:', error)
  })
  await build({
    configFile: false,
    mode: 'development',
    resolve: { conditions: ['node'], mainFields: ['module', 'main'] },
    build: {
      outDir: buildDirectory,
      emptyOutDir: true,
      target: 'node22',
      copyPublicDir: false,
      lib: { entry: 'src/main/dev-entry.ts', formats: ['cjs'], fileName: () => 'backend.cjs' },
      rolldownOptions: { external: ['electron', 'steamworks.js', ...builtinModules, /^node:/] },
    },
  })
  const backendReady = new Promise<number>((resolve, reject) => {
    child = spawn(electron, [path.join(buildDirectory, 'backend.cjs')], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        LWE_DEV_WEB: '1',
        LWE_DEV_FIXTURES: fixtureMode ? '1' : '0',
        LWE_DEV_SCENARIO: scenario,
        LWE_DEV_DATA_DIR: dataDirectory,
        LWE_DEV_TOKEN: token,
      },
    })
    const timeout = setTimeout(
      () => reject(new Error('Backend did not report readiness within 30 seconds')),
      30000,
    )
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(`Backend exited before readiness (${code ?? signal})`))
      if (!shuttingDown) {
        process.exitCode = 1
        void cleanup()
      }
    })
    const lines = createInterface({ input: child.stdout! })
    lines.on('line', (line) => {
      if (line.startsWith(DEV_READY_PREFIX)) {
        try {
          const ready: { port: number } = JSON.parse(line.slice(DEV_READY_PREFIX.length))
          if (!Number.isInteger(ready.port) || ready.port < 1 || ready.port > 65535)
            throw new Error('Invalid backend port')
          clearTimeout(timeout)
          resolve(ready.port)
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      } else console.log(`[backend] ${line}`)
    })
  })
  const backendPort = await backendReady
  const backendUrl = `http://127.0.0.1:${backendPort}`
  const health = await fetch(`${backendUrl}${DEV_HEALTH_PATH}`, {
    headers: { 'x-lwe-dev-token': token },
    signal: AbortSignal.timeout(5000),
  })
  if (!health.ok) throw new Error(`Backend readiness failed: ${health.status}`)
  frontend = await createServer({
    configFile: path.join(root, 'vite.renderer.config.mts'),
    mode: 'development',
    cacheDir: cacheDirectory,
    server: {
      host: '127.0.0.1',
      port: 0,
      open: false,
      proxy: {
        '/api': {
          target: backendUrl,
          ws: true,
          configure(proxy) {
            const authorize = (
              proxyRequest: import('node:http').ClientRequest,
              request: import('node:http').IncomingMessage,
            ) => {
              proxyRequest.setHeader('x-lwe-dev-token', token)
              proxyRequest.setHeader('x-lwe-dev-host', request.headers.host ?? '')
            }
            proxy.on('proxyReq', authorize)
            proxy.on('proxyReqWs', authorize)
          },
        },
      },
    },
  })
  await frontend.listen()
  const address = frontend.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Frontend did not bind a TCP port')
  const url = `http://127.0.0.1:${address.port}`
  console.log(
    `\nBrowser UI: ${url}\nBackend: ${backendUrl}\nData: ${dataDirectory}\nMode: ${fixtureMode ? `fixtures (${scenario})` : 'isolated real services'}\nFrontend HMR is active. Restart this command after backend edits. Ctrl+C closes owned processes.\n`,
  )
  // A machine-readable URL for the regression runner; includes no credentials.
  const ready: DevWebReady = {
    url,
    port: address.port,
    backendPort,
    dataDirectory,
    buildDirectory,
    cacheDirectory,
  }
  console.log(DEV_WEB_READY_PREFIX + JSON.stringify(ready))
} catch (error) {
  console.error(error)
  process.exitCode = 1
  await cleanup()
}
