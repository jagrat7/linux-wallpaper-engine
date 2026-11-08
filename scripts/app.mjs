#!/usr/bin/env node
// Builds the app with Vite and runs it in development; electron-builder packages the result.
//
//   node scripts/app.mjs build   production bundles in .vite/ (what package.json "main" points at)
//   node scripts/app.mjs dev     Vite dev server + watch builds + Electron, restarted on main-process changes
//
// Output layout (kept from Electron Forge so main.ts paths are unchanged):
//   .vite/build/main.js, .vite/build/preload.js, .vite/renderer/main_window/
// DEV_TARGET picks what `dev` opens: web (browser tabs only), desktop (Electron window), full (both).
import { spawn } from 'node:child_process'
import { builtinModules, createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { build, createServer } from 'vite-plus'

const root = path.resolve(import.meta.dirname, '..')
const rendererConfig = path.join(root, 'vite.config.mts')

// Electron and Node built-ins come from the runtime. steamworks.js loads a native
// binary by relative path, so it ships in node_modules instead of the bundle.
const external = [
  'electron',
  'electron/main',
  'electron/common',
  'electron/renderer',
  'steamworks.js',
  ...builtinModules.flatMap((name) => [name, `node:${name}`]),
]

const alias = (directory) => ({
  '@': path.join(root, directory),
  '~': path.join(root, directory),
})

const mainConfig = (mode) => ({
  configFile: false,
  root,
  mode,
  clearScreen: false,
  resolve: {
    alias: alias('src/main'),
    // electron-builder hoists its own ajv, which leaves conf and ajv-formats each a
    // nested copy; bundle one instead of two
    dedupe: ['ajv'],
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: mode === 'production',
    lib: { entry: 'src/main/main.ts', fileName: () => '[name].js', formats: ['cjs'] },
    rollupOptions: { external },
  },
})

const preloadConfig = (mode) => ({
  configFile: false,
  root,
  mode,
  clearScreen: false,
  resolve: { alias: alias('src/preload') },
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: mode === 'production',
    rollupOptions: {
      external,
      input: 'src/preload/preload.ts',
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})

const buildAll = async () => {
  fs.rmSync(path.join(root, '.vite'), { recursive: true, force: true })
  await build(mainConfig('production'))
  await build(preloadConfig('production'))
  await build({ configFile: rendererConfig, root, mode: 'production' })
}

// Resolves after the watcher's first bundle; later bundles call onRebuild.
const watchBuild = async (config, onRebuild) => {
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } })
  await new Promise((resolve, reject) => {
    let first = true
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END') event.result?.close()
      if (event.code === 'ERROR') {
        if (first) reject(event.error)
        else console.error(event.error)
      }
      if (event.code !== 'END') return
      if (first) {
        first = false
        resolve()
      } else onRebuild()
    })
  })
  return watcher
}

const dev = async () => {
  // main.ts checks this against DEV_TARGETS (src/shared/constants/development.ts)
  const target = process.env.DEV_TARGET ?? 'desktop'

  const server = await createServer({ configFile: rendererConfig, root, mode: 'development' })
  await server.listen()
  server.printUrls()
  // The port Vite actually bound: it moves on from 5173 when that one is taken
  const devServerUrl = `http://localhost:${server.httpServer.address().port}`

  let electron = null
  let restarting = false
  let shuttingDown = false
  const electronPath = createRequire(import.meta.url)('electron')
  // Extra args go to Electron, e.g. `-- --remote-debugging-port=9333`
  const electronArgs = process.argv.slice(3).filter((arg) => arg !== '--')

  const shutdown = async (code) => {
    if (shuttingDown) return
    shuttingDown = true
    await stopElectron()
    await Promise.all(watchers.map((watcher) => watcher.close()))
    await server.close()
    process.exit(code)
  }

  const startElectron = () => {
    const child = spawn(electronPath, ['.', ...electronArgs], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: devServerUrl, DEV_TARGET: target },
    })
    // Quitting the app ends the dev session, as `electron-forge start` did
    child.once('exit', (code) => {
      if (electron === child) electron = null
      // A signal leaves code null; treat that as a failure, not a clean quit
      if (!restarting && !shuttingDown) void shutdown(code ?? 1)
    })
    electron = child
    console.log('Launched Electron app. Type rs in terminal to restart main process.')
  }

  // SIGTERM first so the app can stop its wallpaper backends; SIGKILL if it hangs
  const stopElectron = () =>
    new Promise((resolve) => {
      const child = electron
      if (!child || child.exitCode !== null) return resolve()
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
      child.kill('SIGTERM')
    })

  const restartElectron = async () => {
    if (shuttingDown || restarting) return
    restarting = true
    console.log('Main process changed, restarting Electron...')
    await stopElectron()
    restarting = false
    if (!shuttingDown) startElectron()
  }

  const watchers = await Promise.all([
    watchBuild(mainConfig('development'), restartElectron),
    // Preload changes only need the window to reload
    watchBuild(preloadConfig('development'), () => server.ws.send({ type: 'full-reload' })),
  ])

  startElectron()

  for (const [signal, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ]) {
    process.once(signal, () => void shutdown(code))
  }
  if (process.stdin.isTTY) {
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (input) => {
      if (input.trim() === 'rs') void restartElectron()
    })
  }
}

const command = process.argv[2]
if (command === 'build') await buildAll()
else if (command === 'dev') await dev()
else {
  console.error('usage: node scripts/app.mjs <build|dev> [-- electron args]')
  process.exit(2)
}
