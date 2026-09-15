import { plugin } from 'bun'
import * as path from 'node:path'

const dir = import.meta.dir

// Redirect Electron-only modules to headless shims so the backend services
// and tRPC routers can run outside the Electron main process. Runtime
// plugins only support onLoad (matching resolved file paths), so we re-export
// the shim from the intercepted package entry.
plugin({
  name: 'electron-shims',
  setup(build) {
    // Covers both node_modules/electron/index.js and bun's install cache
    // (.../electron@<version>@@@1/index.js)
    build.onLoad({ filter: /\/electron(@[^/]+)?\/index\.js$/ }, () => ({
      contents: [
        `export * from ${JSON.stringify(path.join(dir, 'shims/electron.ts'))}`,
        `export { default } from ${JSON.stringify(path.join(dir, 'shims/electron.ts'))}`,
      ].join('\n'),
      loader: 'ts',
    }))
    build.onLoad({ filter: /\/electron-store(@[^/]+)?\/index\.js$/ }, () => ({
      contents: [
        `export * from ${JSON.stringify(path.join(dir, 'shims/electron-store.ts'))}`,
        `export { default } from ${JSON.stringify(path.join(dir, 'shims/electron-store.ts'))}`,
      ].join('\n'),
      loader: 'ts',
    }))
  },
})
