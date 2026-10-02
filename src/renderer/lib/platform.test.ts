import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mediaUrl } from './platform'

afterEach(() => vi.unstubAllGlobals())
describe('media URLs on both renderer surfaces', () => {
  it('preserves remote images and safely encodes browser paths', () => {
    expect(mediaUrl('https://example.com/preview.jpg?a=1')).toBe(
      'https://example.com/preview.jpg?a=1',
    )
    expect(mediaUrl('/wallpapers/coast #1/preview?.png')).toBe(
      '/api/media?path=%2Fwallpapers%2Fcoast%20%231%2Fpreview%3F.png',
    )
    expect(mediaUrl(null)).toBe('')
  })
  it('uses the native protocol when the preload is present', () => {
    vi.stubGlobal('electronTRPC', {})
    expect(mediaUrl('/wallpapers/coast #1/preview?.png')).toBe(
      'local-file:///wallpapers/coast%20%231/preview%3F.png',
    )
    expect(mediaUrl('https://example.com/preview.jpg')).toBe('https://example.com/preview.jpg')
  })
})
