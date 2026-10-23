#!/usr/bin/env node
// Run against an isolated `lwe launch web` instance with dynamic backgrounds on
// and no applied wallpaper. Uses real library images and ordinary UI clicks.
// Usage: node dev/verify/background-fade.mjs <cdp-url> <app-url> <title> <output.json>
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const toolsDir = process.env.LWE_TOOLS_DIR ?? path.join(import.meta.dirname, '.tools')
const require = createRequire(path.join(toolsDir, 'package.json'))
const { chromium } = require('playwright-core')
const [cdpUrl, appUrl, title, output] = process.argv.slice(2)
assert.ok(cdpUrl && appUrl && title && output, 'Expected CDP URL, app URL, title and output path')

const browser = await chromium.connectOverCDP(cdpUrl)
const phases = []
try {
  const origin = new URL(appUrl).origin
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .find((p) => p.url().startsWith(origin))
  assert.ok(page, 'No verification page at the supplied origin')
  await page.goto(`${origin}/#/`)
  await page.reload()
  await page.getByRole('textbox', { name: 'Search wallpapers...' }).fill(title)
  const card = page.getByRole('heading', { level: 3, name: title, exact: true })
  await card.waitFor()
  assert.equal(await page.locator('img[alt=""]').count(), 0, 'Start with no applied wallpaper')

  for (let cycle = 0; cycle < 3; cycle++) {
    for (const opening of [true, false]) {
      // Read computed opacity, including the final animation frame. Checking
      // only the settled DOM misses native effects reverting before removal.
      await page.evaluate(() => {
        const capture = { running: true, samples: [] }
        window.__backgroundFade = capture
        const sample = (time) => {
          if (!capture.running) return
          const images = [...document.querySelectorAll('img[alt=""]')]
          const previews = [...document.querySelectorAll('#wallpaper-details')]
          capture.samples.push({
            time,
            count: images.length,
            opacity: images.reduce(
              (sum, image) => sum + Number(getComputedStyle(image).opacity),
              0,
            ),
            previewCount: previews.length,
            previewOpacity: previews.reduce(
              (sum, preview) => sum + Number(getComputedStyle(preview).opacity),
              0,
            ),
          })
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      if (opening) await card.click()
      else await page.locator('#wallpaper-details button').first().click()
      await page.waitForTimeout(1200)
      const samples = await page.evaluate(() => {
        window.__backgroundFade.running = false
        return window.__backgroundFade.samples
      })
      phases.push({ cycle, opening, samples })
    }
  }

  for (const { cycle, opening, samples } of phases) {
    const label = `${opening ? 'open' : 'close'} cycle ${cycle + 1}`
    assert.ok(samples.length > 20, `${label}: not enough animation frames`)
    for (const [surface, countKey, opacityKey, target] of [
      ['background', 'count', 'opacity', 0.4],
      ['preview', 'previewCount', 'previewOpacity', 1],
    ]) {
      assert.ok(
        samples.every((sample) => sample[countKey] <= 1),
        `${label}: duplicate ${surface}`,
      )
      assert.ok(
        Math.max(...samples.map((sample) => sample[opacityKey])) > target - 0.01,
        `${label}: ${surface} never appeared`,
      )
      for (let i = 1; i < samples.length; i++) {
        const change = samples[i][opacityKey] - samples[i - 1][opacityKey]
        assert.ok(
          opening ? change >= -0.01 : change <= 0.01,
          `${label}: ${surface} opacity reversed from ${samples[i - 1][opacityKey]} to ${samples[i][opacityKey]}`,
        )
      }
      const last = samples.at(-1)
      assert.equal(last[countKey], opening ? 1 : 0, `${label}: incorrect final ${surface} count`)
      assert.ok(
        Math.abs(last[opacityKey] - (opening ? target : 0)) < 0.001,
        `${label}: incorrect final ${surface} opacity`,
      )
    }
  }
  console.log('PASS: three opens and closes with no background or preview opacity reversal')
} finally {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(output, JSON.stringify({ title, phases }, null, 2))
  await browser.close()
}
