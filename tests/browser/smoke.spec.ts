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

test('semantic controls support skip navigation and keyboard card activation', async ({
  page,
}, testInfo) => {
  await withEvidence(page, testInfo, async () => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Aurora Coast', exact: true })).toBeVisible()
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await skip.focus()
    await skip.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
    const card = page.getByRole('main').getByRole('button', { name: 'Aurora Coast', exact: true })
    await card.focus()
    await card.press('Enter')
    await expect(
      page.locator('#wallpaper-details').getByRole('heading', { name: 'Aurora Coast' }),
    ).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('keyboard-details.png'), fullPage: true })
  })
})

test('roving grid moves focus, activates a card and returns focus after closing details', async ({
  page,
}, testInfo) => {
  await withEvidence(page, testInfo, async () => {
    await page.goto('/')
    const grid = page.getByRole('grid', { name: 'Wallpapers' })
    const aurora = grid.getByRole('button', { name: 'Aurora Coast', exact: true })
    const night = grid.getByRole('button', { name: 'Night Orchard', exact: true })
    const paper = grid.getByRole('button', { name: 'Paper Mountains', exact: true })
    await expect(grid.getByRole('button')).toHaveCount(3)
    await aurora.focus()
    await aurora.press('ArrowRight')
    await expect(night).toBeFocused()
    await expect(night).toHaveAttribute('tabindex', '0')
    await expect(aurora).toHaveAttribute('tabindex', '-1')
    await night.press('End')
    await expect(paper).toBeFocused()
    await paper.press('Home')
    await expect(aurora).toBeFocused()
    await aurora.press('Control+End')
    await expect(paper).toBeFocused()
    await paper.press('Enter')
    await expect(
      page.locator('#wallpaper-details').getByRole('heading', { name: 'Paper Mountains' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#wallpaper-details')).toBeHidden()
    await expect(paper).toBeFocused()
    await expect(paper).toHaveAttribute('aria-expanded', 'false')
    await page.screenshot({ path: testInfo.outputPath('roving-grid.png'), fullPage: true })
  })
})

test('app shortcuts navigate hash routes, focus search and show help without closing underlying details', async ({
  page,
}, testInfo) => {
  await withEvidence(page, testInfo, async () => {
    await page.goto('/')
    const search = page.getByRole('textbox', { name: 'Search wallpapers...' })
    await expect(search).toBeVisible()
    await page.keyboard.press('Control+k')
    await expect(search).toBeFocused()
    await search.fill('Aurora')
    await expect(page.getByRole('grid', { name: 'Wallpapers' }).getByRole('button')).toHaveCount(1)
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(search).toBeFocused()
    await expect(page.getByRole('grid', { name: 'Wallpapers' }).getByRole('button')).toHaveCount(3)
    await page.keyboard.press('Control+5')
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/#\/settings/)
    await page.keyboard.press('Control+3')
    await expect(page.getByRole('heading', { name: 'Playlists', exact: true })).toBeVisible()
    await page.keyboard.press('Control+f')
    await expect(page.getByRole('textbox', { name: 'Search playlists', exact: true })).toBeFocused()
    await page.keyboard.press('Control+1')
    await expect(page.getByRole('heading', { name: 'Installed', exact: true })).toBeVisible()
    const card = page.getByRole('grid').getByRole('button', { name: 'Aurora Coast', exact: true })
    await card.focus()
    await card.press('Enter')
    await expect(page.locator('#wallpaper-details')).toBeVisible()
    await page.keyboard.press('Shift+/')
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('keyboard-shortcuts.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.locator('#wallpaper-details')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#wallpaper-details')).toBeHidden()
    await expect(card).toBeFocused()
  })
})
