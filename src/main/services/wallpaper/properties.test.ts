import { describe, expect, it } from 'vitest'
import { parseProjectProperties, serializePropertyValue } from './properties'

const project = (properties: Record<string, unknown>) => ({ general: { properties } })

describe('serializePropertyValue', () => {
  it('serializes booleans as 1/0', () => {
    expect(serializePropertyValue(true)).toBe('1')
    expect(serializePropertyValue(false)).toBe('0')
  })

  it('serializes numbers and strings verbatim', () => {
    expect(serializePropertyValue(1.2)).toBe('1.2')
    expect(serializePropertyValue('0.1 0.2 0.4')).toBe('0.1 0.2 0.4')
  })
})

describe('parseProjectProperties', () => {
  it('returns empty array for missing or malformed projects', () => {
    expect(parseProjectProperties(null)).toEqual([])
    expect(parseProjectProperties({})).toEqual([])
    expect(parseProjectProperties({ general: { properties: 'nope' } })).toEqual([])
  })

  it('parses supported control types with metadata', () => {
    const result = parseProjectProperties(project({
      bloom: { type: 'bool', text: 'Bloom', value: true, order: 2 },
      barcount: { type: 'slider', text: 'Bar Count', value: 64, min: 16, max: 64, step: 1, order: 1 },
      frequency: {
        type: 'combo',
        text: 'Frequency',
        value: 2,
        order: 3,
        options: [{ label: '16', value: 1 }, { label: '32', value: 2 }],
      },
    }))

    expect(result.map(p => p.name)).toEqual(['barcount', 'bloom', 'frequency'])
    expect(result[0]).toMatchObject({ type: 'slider', value: '64', min: 16, max: 64, step: 1 })
    expect(result[1]).toMatchObject({ type: 'bool', value: '1' })
    expect(result[2].options).toEqual([{ label: '16', value: '1' }, { label: '32', value: '2' }])
  })

  it('skips unsupported types and falls back to index for ordering', () => {
    const result = parseProjectProperties(project({
      heading: { type: 'text', value: true },
      group: { index: 5 },
      owl: { type: 'bool', value: false, index: 2 },
      schemecolor: { type: 'color', value: '0.1 0.2 0.4', index: 1 },
    }))

    expect(result.map(p => p.name)).toEqual(['schemecolor', 'owl'])
    expect(result[0].value).toBe('0.1 0.2 0.4')
  })

  it('uses the property name when text is missing', () => {
    const result = parseProjectProperties(project({ rain: { type: 'bool', value: false } }))
    expect(result[0].text).toBe('rain')
  })
})
