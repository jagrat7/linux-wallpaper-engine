import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { DEV_READY_PREFIX } from '../shared/constants/development'

// No router/service imports above this boundary: electron-store is eager.
if (app.isPackaged || process.env.LWE_DEV_WEB !== '1' || !process.env.LWE_DEV_DATA_DIR) {
  throw new Error('The browser backend requires explicit development mode and isolated data')
}
const dataDirectory = path.resolve(process.env.LWE_DEV_DATA_DIR)
fs.mkdirSync(dataDirectory, { recursive: true })
app.setPath('userData', dataDirectory)
app.setPath('sessionData', path.join(dataDirectory, 'session'))
app
  .whenReady()
  .then(async () => {
    const { appRouter } = await import('./trpc/router')
    const { wallpaperService } = await import('./services/wallpaper/wallpaper')
    const { systemThemeService } = await import('./services/system-theme/system-theme')
    if (process.env.LWE_DEV_FIXTURES === '1') {
      const { installFixtures } = await import('./development/fixtures')
      await installFixtures(dataDirectory)
    }
    const { startDevGateway } = await import('./development/gateway')
    const gateway = await startDevGateway({
      router: appRouter,
      token: process.env.LWE_DEV_TOKEN ?? '',
      catalog: async () => (await wallpaperService.query()).wallpapers,
    })
    console.log(DEV_READY_PREFIX + JSON.stringify({ port: gateway.port, dataDirectory }))
    let closing = false
    const close = async () => {
      if (closing) return
      closing = true
      await gateway.close()
      await wallpaperService.diagnose({ kind: 'cleanup' })
      systemThemeService.stopWatching()
      app.quit()
    }
    process.on('SIGINT', () => {
      void close()
    })
    process.on('SIGTERM', () => {
      void close()
    })
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
