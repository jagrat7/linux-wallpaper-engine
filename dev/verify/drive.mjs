#!/usr/bin/env node
// Drives the running verification instance over CDP (headless Chromium for `web`,
// the Electron window for `desktop`). One command per invocation; state lives in the app.
// Usage: drive.mjs <cdp-url> <app-url> <command> [flags]   (normally called through `lwe drive`)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

// playwright-core lives in dev/verify/.tools/ next to this file (installed by `lwe setup`), not globally
const cacheDir =
  process.env.LWE_TOOLS_DIR ?? path.join(path.dirname(new URL(import.meta.url).pathname), '.tools')
const require = createRequire(path.join(cacheDir, 'package.json'))
const { chromium } = require('playwright-core')

const [cdpUrl, appUrl, command, ...rest] = process.argv.slice(2)

const flags = {}
const positional = []
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i]
  if (arg.startsWith('--')) {
    const key = arg.slice(2)
    const next = rest[i + 1]
    if (next === undefined || next.startsWith('--')) flags[key] = true
    else {
      flags[key] = next
      i++
    }
  } else positional.push(arg)
}

const timeout = Number(flags.timeout ?? 10000)

const ensureDir = (file) => fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })

const locate = (page) => {
  const exact = Boolean(flags.exact)
  let loc
  // Setting rows render `<div><span>Label</span><div>control</div></div>` with unnamed controls
  if (flags.row) {
    const row = page.locator(`div:has(> span:text-is(${JSON.stringify(flags.row)}))`).last()
    loc = row.getByRole(flags.role ?? 'switch')
  } else if (flags.role) loc = page.getByRole(flags.role, flags.name ? { name: flags.name, exact } : {})
  else if (flags.label) loc = page.getByLabel(flags.label, { exact })
  else if (flags.placeholder) loc = page.getByPlaceholder(flags.placeholder, { exact })
  else if (flags.text) loc = page.getByText(flags.text, { exact })
  else if (flags.css) loc = page.locator(flags.css)
  else throw new Error('Need one of --role/--label/--placeholder/--text/--css')
  if (flags.within) loc = page.locator(flags.within).locator(loc)
  if (flags.nth !== undefined) loc = loc.nth(Number(flags.nth))
  return loc
}

const browser = await chromium.connectOverCDP(cdpUrl, { timeout })
try {
  const origin = new URL(appUrl).origin
  const pages = browser.contexts().flatMap((context) => context.pages())
  const page = pages.find((p) => p.url().startsWith(origin)) ?? pages[0]
  if (!page) throw new Error('No page found over CDP')
  page.setDefaultTimeout(timeout)

  switch (command) {
    case 'url':
      console.log(page.url())
      break
    case 'goto': {
      // Hash router: routes are `#/`, `#/workshop`, `#/playlists`, `#/displays`, `#/settings`
      const route = positional[0] ?? '/'
      await page.goto(`${appUrl.replace(/\/$/, '')}/#${route}`)
      await page.waitForLoadState('domcontentloaded')
      console.log(page.url())
      break
    }
    case 'reload':
      await page.reload()
      console.log(page.url())
      break
    case 'snapshot': {
      const root = flags.css ? page.locator(flags.css).first() : page.locator('body')
      const tree = await root.ariaSnapshot()
      if (flags.path) {
        ensureDir(flags.path)
        fs.writeFileSync(flags.path, tree)
        console.log(`wrote ${flags.path}`)
      } else console.log(tree)
      break
    }
    case 'screenshot': {
      const file = flags.path ?? 'screenshot.png'
      ensureDir(file)
      // Optional locator flags scroll that element into view first so it is in the shot
      if (flags.row || flags.role || flags.label || flags.text || flags.css || flags.placeholder)
        await locate(page).first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: file, fullPage: Boolean(flags.full) })
      console.log(`wrote ${file}`)
      break
    }
    case 'click':
      await locate(page).click()
      console.log('clicked')
      break
    case 'hover':
      await locate(page).hover()
      console.log('hovered')
      break
    case 'fill':
      await locate(page).fill(String(flags.value ?? ''))
      console.log('filled')
      break
    case 'check':
      await locate(page).check()
      console.log('checked')
      break
    case 'uncheck':
      await locate(page).uncheck()
      console.log('unchecked')
      break
    case 'press':
      if (flags.role || flags.label || flags.text || flags.css || flags.placeholder)
        await locate(page).press(flags.key)
      else await page.keyboard.press(flags.key)
      console.log(`pressed ${flags.key}`)
      break
    case 'wait': {
      const state = flags.state ?? 'visible'
      await locate(page).first().waitFor({ state, timeout })
      console.log(`ok: ${state}`)
      break
    }
    case 'count':
      console.log(await locate(page).count())
      break
    case 'text':
      console.log(await locate(page).first().innerText())
      break
    case 'attr':
      console.log(await locate(page).first().getAttribute(flags.attr))
      break
    case 'eval':
      console.log(JSON.stringify(await page.evaluate(positional.join(' ')), null, 2))
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
} catch (error) {
  // Short, greppable failure instead of a stack trace; non-zero exit fails the step
  console.error(`drive ${command} failed: ${String(error.message ?? error).split('\n').slice(0, 4).join(' | ')}`)
  process.exitCode = 1
} finally {
  // Disconnect only: closing would kill the browser/app we are attached to
  await browser.close().catch(() => {})
}
