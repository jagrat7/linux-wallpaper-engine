import { afterEach, expect, it, vi } from 'vite-plus/test'

const state = vi.hoisted(() => ({ app: { isPackaged: true } }))
vi.mock('electron', () => state)
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('ignores development environment flags in packaged apps', async () => {
  vi.stubEnv('LWE_DEV_WEB', '1')
  vi.stubEnv('LWE_DEV_FIXTURES', '1')
  vi.stubEnv('LWE_DEV_DATA_DIR', '/tmp/should-not-be-used')
  const mode = await import('./mode')
  expect(mode.isBrowserDev).toBe(false)
  expect(mode.isFixtureMode).toBe(false)
  expect(mode.isolatedDataDirectory).toBeUndefined()
})
