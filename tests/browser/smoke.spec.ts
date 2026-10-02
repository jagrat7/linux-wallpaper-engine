import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import type { AppRouter } from '../../src/main/trpc/router'
import { DEV_API_PATH } from '../../src/shared/constants/development'
import { withEvidence, selectWallpaper } from './evidence'
import { test, expect } from '@playwright/test'

if (!process.env.LWE_BROWSER_URL)
  throw new Error('Use vp run verify:web to start isolated fixtures')

test('same renderer loads library, media, displays, playlists, settings and Workshop unavailable state', async ({
  page,
}, testInfo) => {
  await withEvidence(page, testInfo, async () => {
    await page.goto('/')
    await expect(page.getByText('Aurora Coast', { exact: true }).first()).toBeVisible()
    const images = page.locator('img[src*="/api/media"]')
    await expect(images.first()).toBeVisible()
    await expect
      .poll(() =>
        images.evaluateAll((nodes) =>
          nodes.every(
            (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true)
    await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true })
    const observer = await page.context().newPage()
    try {
      await withEvidence(
        observer,
        testInfo,
        async () => {
          await observer.goto('/#/displays')
          await expect(
            observer.getByRole('heading', { name: 'Displays', exact: true }),
          ).toBeVisible()
          await expect(observer.getByText('No active wallpaper', { exact: true })).toBeVisible()
          await selectWallpaper(page, 'Aurora Coast')
          await page.getByRole('button', { name: 'Apply', exact: true }).click()
          await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
          // Another mounted client must update through WS invalidation before the 5s poll.
          await expect(observer.getByText('2/2 active', { exact: true })).toBeVisible({
            timeout: 2500,
          })
          await observer.screenshot({
            path: testInfo.outputPath('displays-active.png'),
            fullPage: true,
          })
          await page.getByRole('button', { name: 'Stop', exact: true }).click()
          await expect(observer.getByText('No active wallpaper', { exact: true })).toBeVisible({
            timeout: 2500,
          })
        },
        'observer',
      )
    } finally {
      await observer.close()
    }
    await page.goto('/#/displays')
    await expect(page.getByRole('heading', { name: 'Displays', exact: true })).toBeVisible()
    await expect(page.getByText('DP-1', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('HDMI-A-1', { exact: true }).first()).toBeVisible()
    await page.goto('/#/playlists')
    await expect(page.getByRole('heading', { name: 'Playlists', exact: true })).toBeVisible()
    await expect(page.getByText('Evening rotation', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await expect(page.getByText('2/2 active', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('playlist-active.png'), fullPage: true })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(page.getByText('No active wallpaper', { exact: true })).toBeVisible()
    await page.goto('/#/settings')
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    const fullscreenSwitch = page
      .getByText('Pause on fullscreen apps', { exact: true })
      .locator('..')
      .getByRole('switch')
    await expect(fullscreenSwitch).toBeChecked()
    await fullscreenSwitch.click()
    await expect(fullscreenSwitch).not.toBeChecked()
    await page.reload()
    await expect(fullscreenSwitch).not.toBeChecked()
    await fullscreenSwitch.click()
    await expect(fullscreenSwitch).toBeChecked()
    await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true })
    await page.goto('/#/workshop')
    await expect(page.getByText(/Start Steam/).first()).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: testInfo.outputPath('workshop.png'), fullPage: true })
  })
})

test('fixture pause/resume invalidation and random selection update mounted UI', async ({
  page,
}, testInfo) => {
  await withEvidence(page, testInfo, async () => {
    const ws = createWSClient({
      url: process.env.LWE_BROWSER_URL!.replace('http:', 'ws:') + DEV_API_PATH,
    })
    try {
      const client = createTRPCClient<AppRouter>({ links: [wsLink({ client: ws })] })
      await client.wallpaper.stopWalpaper.mutate()
      await page.goto('/')
      const footer = page.getByRole('contentinfo')
      await expect(footer.getByText('No active wallpaper')).toBeVisible()
      await client.wallpaper.random.mutate()
      await expect(footer.getByRole('button', { name: 'Aurora Coast', exact: true })).toBeVisible({
        timeout: 2500,
      })
      await footer.getByRole('button', { name: 'Pause wallpaper', exact: true }).click()
      await expect(
        footer.getByRole('button', { name: 'Resume wallpaper', exact: true }),
      ).toBeVisible()
      expect(
        (await client.wallpaper.getActiveWallpaper.query()).find((item) => item.screen === 'DP-1')
          ?.paused,
      ).toBe(true)
      await client.wallpaper.resume.mutate()
      await expect(
        footer.getByRole('button', { name: 'Pause wallpaper', exact: true }),
      ).toBeVisible({ timeout: 2500 })
      await client.wallpaper.random.mutate()
      await expect(
        footer.getByRole('button', { name: 'Paper Mountains', exact: true }),
      ).toBeVisible({ timeout: 2500 })
      await page.screenshot({ path: testInfo.outputPath('fixture-playback.png'), fullPage: true })
      await client.wallpaper.stopWalpaper.mutate()
      await expect(footer.getByText('No active wallpaper')).toBeVisible({ timeout: 2500 })
    } finally {
      await ws.close()
    }
  })
})
