import { expect, type Page, type TestInfo } from '@playwright/test'

export async function withEvidence(
  page: Page,
  testInfo: TestInfo,
  run: () => Promise<void>,
  label = 'page',
) {
  const failures: string[] = []
  const consoleEntries: string[] = []
  const networkEntries: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (message) => {
    consoleEntries.push(`${message.type()}: ${message.text()}`)
    if (message.type() === 'error') failures.push(message.text())
  })
  page.on('requestfailed', (request) =>
    failures.push(`${request.url()}: ${request.failure()?.errorText}`),
  )
  page.on('response', (response) => {
    networkEntries.push(`${response.status()} ${response.url()}`)
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  try {
    await run()
    expect(failures).toEqual([])
  } finally {
    await testInfo.attach(`${label}-console`, {
      body: consoleEntries.join('\n'),
      contentType: 'text/plain',
    })
    await testInfo.attach(`${label}-network`, {
      body: networkEntries.join('\n'),
      contentType: 'text/plain',
    })
    await testInfo.attach(`${label}-failures`, {
      body: failures.join('\n'),
      contentType: 'text/plain',
    })
  }
}

// Keyboard-navigation branches expose the card as a semantic button. Retain a
// heading target for the original card UI while selecting through the real control.
export async function selectWallpaper(page: Page, title: string) {
  const heading = page.getByRole('heading', { name: title, exact: true })
  await expect(heading).toBeVisible()
  const button = page.getByRole('main').getByRole('button', { name: title, exact: true })
  if (await button.count()) await button.click()
  else await heading.click()
}
