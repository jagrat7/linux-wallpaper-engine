import { describe, expect, it } from 'vite-plus/test'
import { pageFromArgv, pageFromLaunchData } from './launch'

describe('pageFromArgv', () => {
  it.each(['installed', 'workshop', 'playlists', 'displays', 'settings'] as const)(
    'accepts %s in both flag forms among Electron arguments',
    (page) => {
      expect(pageFromArgv(['electron', '.', '--no-sandbox', '--page', page])).toBe(page)
      expect(
        pageFromArgv(['wallpaperx', `--page=${page}`, '--original-process-start-time=1']),
      ).toBe(page)
    },
  )

  it.each([
    [],
    ['--page'],
    ['--page='],
    ['--page', 'unknown'],
    ['--page', '/workshop'],
    ['--page', 'constructor'],
    ['--page', '__proto__'],
    ['--page=workshop;alert(1)'],
    ['--page', "workshop';alert(1)//"],
    ['--', '--page', 'workshop'],
    ['--homepage=workshop'],
  ])('ignores unsupported or missing pages in %j', (...argv) => {
    expect(pageFromArgv(argv)).toBeUndefined()
  })

  it('uses the first valid page when the flag is repeated', () => {
    expect(pageFromArgv(['--page=unknown', '--page', 'settings', '--page=workshop'])).toBe(
      'settings',
    )
    expect(pageFromArgv(['--page', '--page=workshop'])).toBe('workshop')
  })
})

describe('pageFromLaunchData', () => {
  it('reads the page independently of Chromium argument reordering', () => {
    expect(pageFromLaunchData({ page: 'workshop' })).toBe('workshop')
  })

  it.each([
    undefined,
    null,
    {},
    { page: null },
    { page: 'constructor' },
    { page: '/settings' },
    'settings',
  ])('ignores invalid launch data: %j', (data) => {
    expect(pageFromLaunchData(data)).toBeUndefined()
  })
})
