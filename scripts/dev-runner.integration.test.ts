import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { chromium, expect as browserExpect } from '@playwright/test'
import type { AppRouter } from '../src/main/trpc/router'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vite-plus/test'
import { stopOwnedProcess } from './dev-process'
import { startFixtureRunner } from './fixture-runner'
import { DEV_HEALTH_PATH, DEV_API_PATH, DEV_MEDIA_PATH } from '../src/shared/constants/development'

// Opt-in: requires Electron native libraries, a display/xvfb and installed Chromium.
it.skipIf(process.env.LWE_NATIVE_BRIDGE_TEST !== '1')(
  'renders development React, isolates concurrent fixture runs and cleans up owned listeners',
  async () => {
    const logs: string[] = []
    const runners = [
      startFixtureRunner('populated', (line) => logs.push(line)),
      startFixtureRunner('populated', (line) => logs.push(line)),
    ]
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      const [ready, other] = await Promise.all(runners.map((runner) => runner.ready))
      console.log(`Bridge ready: ${ready.url}; isolated data: ${ready.dataDirectory}`)
      expect(ready.dataDirectory).toContain('.dev-runtime')
      expect(ready.dataDirectory).not.toBe(other.dataDirectory)
      expect(ready.buildDirectory).not.toBe(other.buildDirectory)
      expect((await fetch(ready.url + DEV_HEALTH_PATH)).status).toBe(200)
      const html = await (await fetch(ready.url)).text()
      expect(html).toContain('injectIntoGlobalHook(window)')
      expect(html).toContain('window.$RefreshSig$')
      expect(
        (await fetch(ready.url + DEV_HEALTH_PATH, { headers: { origin: 'https://example.com' } }))
          .status,
      ).toBe(403)
      expect((await fetch(`http://127.0.0.1:${ready.backendPort}${DEV_HEALTH_PATH}`)).status).toBe(
        403,
      )
      const ws = createWSClient({ url: ready.url.replace('http:', 'ws:') + DEV_API_PATH })
      try {
        const client = createTRPCClient<AppRouter>({ links: [wsLink({ client: ws })] })
        expect(await client.health.query()).toEqual({ status: 'ok' })
        const wallpapers = (await client.wallpaper.getWallpapers.query()).wallpapers
        expect(wallpapers).toHaveLength(3)
        const preview = await fetch(
          ready.url + DEV_MEDIA_PATH + '?path=' + encodeURIComponent(wallpapers[0].thumbnail),
        )
        expect(preview.status).toBe(200)
        expect(preview.headers.get('content-type')).toBe('image/svg+xml')
        await client.settings.update.mutate({ volume: 42 })
        const readSettings = async (directory: string) =>
          JSON.parse(await fs.readFile(path.join(directory, 'settings.json'), 'utf-8')) as {
            volume: number
          }
        expect((await readSettings(ready.dataDirectory)).volume).toBe(42)
        expect((await readSettings(other.dataDirectory)).volume).not.toBe(42)
      } finally {
        await ws.close()
      }
      browser = await chromium.launch()
      const context = await browser.newContext()
      await fs.mkdir('test-results/bridge', { recursive: true })
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      const page = await context.newPage()
      const failures: string[] = []
      page.on('pageerror', (error) => failures.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text())
      })
      page.on('requestfailed', (request) =>
        failures.push(`${request.url()}: ${request.failure()?.errorText}`),
      )
      try {
        await page.goto(ready.url)
        await browserExpect(
          page.getByRole('heading', { name: 'Aurora Coast', exact: true }),
        ).toBeVisible()
        await page.screenshot({ path: 'test-results/bridge/startup.png' })
        let navigations = 0
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) navigations++
        })
        const probes = [
          path.join(ready.dataDirectory, 'watcher-probe.html'),
          'test-results/bridge/watcher-probe.html',
          'playwright-report/watcher-probe.html',
        ]
        try {
          await fs.mkdir('playwright-report', { recursive: true })
          await Promise.all(
            probes.map((file) => fs.writeFile(file, '<p>Verification evidence</p>')),
          )
          // Observe the file-watcher debounce window, not server startup readiness.
          await page.waitForTimeout(700)
          expect(navigations).toBe(0)
        } finally {
          await Promise.all(probes.map((file) => fs.rm(file, { force: true })))
        }
        expect(failures).toEqual([])
      } finally {
        await context.tracing.stop({ path: 'test-results/bridge/trace.zip' })
        await context.close()
      }
      await stopOwnedProcess(runners[1].process)
      expect(runners[1].process.exitCode).toBe(0)
      await expect(fetch(other.url + DEV_HEALTH_PATH)).rejects.toThrow()
      expect((await fetch(ready.url + DEV_HEALTH_PATH)).status).toBe(200)
      await fs.access(path.join(ready.buildDirectory, 'backend.cjs'))
      await stopOwnedProcess(runners[0].process)
      expect(runners[0].process.exitCode).toBe(0)
      await expect(fetch(ready.url + DEV_HEALTH_PATH)).rejects.toThrow()
      await expect(
        fetch(`http://127.0.0.1:${ready.backendPort}${DEV_HEALTH_PATH}`),
      ).rejects.toThrow()
    } finally {
      await browser?.close()
      await Promise.all(runners.map((runner) => stopOwnedProcess(runner.process)))
      await fs.mkdir('test-results/bridge', { recursive: true })
      await fs.writeFile('test-results/bridge/dev-server.log', logs.join('\n'))
    }
  },
  90000,
)
