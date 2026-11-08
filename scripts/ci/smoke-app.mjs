#!/usr/bin/env node
// Drives a packaged app launched with --remote-debugging-port and saves screenshots as proof.
//   settings (default, distro-smoke.sh): the UI loads and "Launch on startup" turns on
//   update (appimage-update-smoke.sh): the banner offers a newer version, downloads it,
//     and "Restart to update" is clicked
// Usage: smoke-app.mjs <cdp-port> <out-dir> [settings|update]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

// playwright-core comes from dev/verify/.tools/, installed by `dev/verify/lwe setup`
const toolsDir =
  process.env.LWE_TOOLS_DIR ??
  path.join(path.dirname(new URL(import.meta.url).pathname), '../../dev/verify/.tools')
const { chromium } = createRequire(path.join(toolsDir, 'package.json'))('playwright-core')

const [port, outDir, mode = 'settings'] = process.argv.slice(2)
if (!port || !outDir || !['settings', 'update'].includes(mode)) {
  console.error('usage: smoke-app.mjs <cdp-port> <out-dir> [settings|update]')
  process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })

const step = (message) => console.log(`smoke: ${message}`)

// The app needs a few seconds to start under Xvfb; retry until CDP answers.
const connect = async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error(`no CDP endpoint on port ${port} after 60s`)
}

const checkUpdate = async (page) => {
  const bannerText = async (locator) =>
    (await locator.locator('..').innerText()).replace(/\s+/g, ' ')
  const available = page.getByText('Update available:')
  await available.waitFor({ timeout: 30_000 })
  step(`banner: ${await bannerText(available)}`)
  await page.screenshot({ path: path.join(outDir, '2-update-available.png') })
  await page.getByRole('button', { name: 'Update now' }).click()
  const restart = page.getByRole('button', { name: 'Restart to update' })
  await restart.waitFor({ timeout: 180_000 })
  step(`banner: ${await bannerText(restart)}`)
  await page.screenshot({ path: path.join(outDir, '3-update-ready.png') })
  await restart.click()
  step('clicked "Restart to update"')
}

const turnOnAutostart = async (page) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  // Settings rows render `<div><span>Label</span>control</div>` with an unnamed switch
  const row = page.locator('div:has(> span:text-is("Launch on startup"))').last()
  const toggle = row.getByRole('switch')
  await toggle.waitFor({ timeout: 15_000 })
  if ((await toggle.getAttribute('aria-checked')) !== 'false') {
    throw new Error('"Launch on startup" should start off on a fresh install')
  }
  await toggle.click()
  await page.waitForFunction(
    (el) => el?.getAttribute('aria-checked') === 'true',
    await toggle.elementHandle(),
    { timeout: 10_000 },
  )
  step('turned on "Launch on startup"')
  // Let the switch finish animating so the screenshot shows it on
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(outDir, '2-settings.png') })
}

const browser = await connect()
try {
  const context = browser.contexts()[0]
  const page =
    context.pages().find((p) => !p.url().startsWith('devtools://')) ??
    (await context.waitForEvent('page', { timeout: 30_000 }))

  await page.getByRole('button', { name: 'Installed', exact: true }).waitFor({ timeout: 60_000 })
  step(`UI loaded from ${page.url()}`)
  await page.screenshot({ path: path.join(outDir, '1-launched.png') })

  await (mode === 'update' ? checkUpdate(page) : turnOnAutostart(page))
} finally {
  // Disconnect only; the calling script stops the app and checks what it wrote.
  await browser.close().catch(() => {})
}
