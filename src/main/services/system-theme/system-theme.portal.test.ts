import { describe, expect, it } from 'vitest'
import { parsePortalAccent, parsePortalScheme } from './system-theme.portal'

describe('parsePortalScheme', () => {
  it('parses dark and light portal values', () => {
    expect(parsePortalScheme('(<<uint32 1>>, )')).toBe('dark')
    expect(parsePortalScheme('u 2')).toBe('light')
  })

  it('treats unknown values as no preference', () => {
    expect(parsePortalScheme('uint32 0')).toBeNull()
    expect(parsePortalScheme('uint32 99')).toBeNull()
  })
})

describe('parsePortalAccent', () => {
  it('parses gdbus and busctl tuples', () => {
    expect(parsePortalAccent('(<(0.1, 0.2, 0.3)>,)')).toBe('color(srgb 0.1 0.2 0.3)')
    expect(parsePortalAccent('(ddd) 0.4 0.5 0.6')).toBe('color(srgb 0.4 0.5 0.6)')
  })

  it('rejects channels outside the portal range', () => {
    expect(parsePortalAccent('(1.1, 0.2, 0.3)')).toBeNull()
    expect(parsePortalAccent('double -0.1\ndouble 0.2\ndouble 0.3')).toBeNull()
  })
})
