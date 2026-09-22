import { describe, it, expect } from 'vitest'
import { isNewerVersion, stripVersionPrefix } from './version'

describe('stripVersionPrefix', () => {
  it('removes a leading v', () => {
    expect(stripVersionPrefix('v1.2.3')).toBe('1.2.3')
  })

  it('leaves versions without a prefix unchanged', () => {
    expect(stripVersionPrefix('1.2.3')).toBe('1.2.3')
  })
})

describe('isNewerVersion', () => {
  it('returns true when latest is newer', () => {
    expect(isNewerVersion('0.5.0', '0.4.4')).toBe(true)
  })

  it('returns false when versions match', () => {
    expect(isNewerVersion('0.4.4', '0.4.4')).toBe(false)
  })

  it('returns false when current is newer than latest', () => {
    expect(isNewerVersion('0.4.4', '0.5.0')).toBe(false)
  })

  it('handles v-prefixed release tags', () => {
    expect(isNewerVersion('v0.5.0', '0.4.4')).toBe(true)
    expect(isNewerVersion('v0.4.4', '0.5.0')).toBe(false)
  })

  it('returns false for invalid versions', () => {
    expect(isNewerVersion('not-a-version', '0.4.4')).toBe(false)
    expect(isNewerVersion('0.5.0', 'not-a-version')).toBe(false)
  })
})
