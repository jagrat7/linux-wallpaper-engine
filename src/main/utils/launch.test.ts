import { describe, expect, it } from 'vite-plus/test'
import { pageFromArgv, pageFromLaunchData } from './launch'

describe('pageFromArgv', () => {
  it.each(['installed', 'workshop', 'playlists', 'displays', 'settings'] as const)(
    'reads %s in both flag forms among Electron arguments',
    (page) => {
      expect(pageFromArgv(['electron', '.', '--no-sandbox', '--page', page])).toBe(page)
      expect(pageFromArgv(['wallpaperx', `--page=${page}`, '--enable-features=X'])).toBe(page)
    },
  )

  it.each([
    [],
    ['--page'],
    ['--page='],
    ['--page', 'unknown'],
    ['--page', '/workshop'],
    ['--page', 'constructor'],
    ['--page', "workshop';alert(1)//"],
    ['--', '--page', 'workshop'],
    ['--homepage=workshop'],
  ])('ignores a missing or unknown page in %j', (...argv) => {
    expect(pageFromArgv(argv)).toBeUndefined()
  })

  it('uses the first valid page when the flag is repeated', () => {
    expect(pageFromArgv(['--page=unknown', '--page', 'settings', '--page=workshop'])).toBe(
      'settings',
    )
  })
})

describe('pageFromLaunchData', () => {
  it('reads the page a second launch handed over', () => {
    expect(pageFromLaunchData({ page: 'workshop' })).toBe('workshop')
  })

  it.each([undefined, null, {}, { page: 'constructor' }, { page: '/settings' }, 'settings'])(
    'ignores invalid launch data: %j',
    (data) => {
      expect(pageFromLaunchData(data)).toBeUndefined()
    },
  )
})
