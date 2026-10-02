import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { ITEM_STATE_INSTALLED } from '../../../shared/constants/workshop'

const { init, download } = vi.hoisted(() => ({ init: vi.fn(), download: vi.fn() }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('../settings', () => ({ settingsService: {} }))
vi.mock('steamworks.js', () => ({ init }))
beforeEach(() => {
  vi.resetModules()
  init.mockReturnValue({
    workshop: {
      getSubscribedItems: () => [1n, 2n],
      state: (id: bigint) => (id === 1n ? ITEM_STATE_INSTALLED : 0),
      download,
      downloadInfo: () => null,
      installInfo: () => null,
    },
  })
})
afterEach(() => vi.unstubAllEnvs())

it('suppresses automatic downloads in browser mode, including after explicit read access', async () => {
  vi.stubEnv('LWE_DEV_WEB', '1')
  const { workshopService } = await import('./workshop')
  await workshopService.syncSubscribedItems()
  expect(init).not.toHaveBeenCalled()
  await workshopService.itemStatus('1')
  expect(init).toHaveBeenCalledOnce()
  expect(download).not.toHaveBeenCalled()
})

it('retains desktop connection-time sync for subscribed items missing from disk', async () => {
  vi.stubEnv('LWE_DEV_WEB', '0')
  const { workshopService } = await import('./workshop')
  await workshopService.itemStatus('1')
  await vi.waitFor(() => expect(download).toHaveBeenCalledExactlyOnceWith(2n, false))
  expect(init).toHaveBeenCalledOnce()
})
