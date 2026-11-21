import { describe, expect, it } from 'vite-plus/test'
import { WORKSHOP_RESOLUTION_OPTIONS } from '../../../shared/constants/workshop'
import {
  buildFilterCombinations,
  mapWorkshopItems,
  parseWorkshopResolution,
  toWorkshopResolutionTag,
} from './workshop.utils'

const noFilters = {
  workshopFilterType: [],
  workshopFilterAgeRating: [],
  workshopFilterTags: [],
  workshopFilterResolution: [],
}

const sorted = (combinations: string[][]) =>
  combinations.map((tags) => tags.toSorted()).toSorted((a, b) => a.join().localeCompare(b.join()))

describe('buildFilterCombinations', () => {
  it('returns one unfiltered query when nothing is selected', () => {
    expect(buildFilterCombinations(noFilters)).toEqual([[]])
  })

  it('requires a single selected resolution', () => {
    expect(
      buildFilterCombinations({ ...noFilters, workshopFilterResolution: ['3840x2160'] }),
    ).toEqual([['3840 x 2160']])
  })

  it('matches any of several selected resolutions instead of all of them', () => {
    const combinations = buildFilterCombinations({
      ...noFilters,
      workshopFilterResolution: ['3840x2160', '2560x1440'],
    })

    expect(sorted(combinations)).toEqual([['2560 x 1440'], ['3840 x 2160']])
  })

  it('combines resolutions with the other multi-select categories', () => {
    const combinations = buildFilterCombinations(
      {
        ...noFilters,
        workshopFilterType: ['scene'],
        workshopFilterAgeRating: ['g', 'pg13'],
        workshopFilterTags: ['Nature'],
        workshopFilterResolution: ['3840x2160', 'Dynamic resolution'],
      },
      ['Wallpaper'],
    )

    expect(sorted(combinations)).toEqual(
      sorted([
        ['Wallpaper', 'Nature', 'Scene', 'Everyone', '3840 x 2160'],
        ['Wallpaper', 'Nature', 'Scene', 'Everyone', 'Dynamic resolution'],
        ['Wallpaper', 'Nature', 'Scene', 'Questionable', '3840 x 2160'],
        ['Wallpaper', 'Nature', 'Scene', 'Questionable', 'Dynamic resolution'],
      ]),
    )
  })

  it('ignores unknown and duplicate resolutions', () => {
    expect(
      buildFilterCombinations({
        ...noFilters,
        workshopFilterResolution: ['Unknown', '3840x2160', '3840 x 2160'],
      }),
    ).toEqual([['3840 x 2160']])
  })

  it('matches any of several selected tags instead of all of them', () => {
    const combinations = buildFilterCombinations({
      ...noFilters,
      workshopFilterTags: ['Nature', 'Anime'],
    })

    expect(sorted(combinations)).toEqual([['Anime'], ['Nature']])
  })

  it('keeps base tags required alongside any-of tags', () => {
    const combinations = buildFilterCombinations(
      { ...noFilters, workshopFilterTags: ['Nature', 'Anime'] },
      ['Wallpaper'],
    )

    expect(sorted(combinations)).toEqual([
      ['Anime', 'Wallpaper'],
      ['Nature', 'Wallpaper'],
    ])
  })

  it('ignores blank and duplicate tags', () => {
    expect(
      buildFilterCombinations({ ...noFilters, workshopFilterTags: ['Nature', ' Nature ', ''] }),
    ).toEqual([['Nature']])
  })
})

describe('WORKSHOP_RESOLUTION_OPTIONS', () => {
  it('stores values that convert to the Steam tag each option shows', () => {
    for (const option of WORKSHOP_RESOLUTION_OPTIONS) {
      expect(toWorkshopResolutionTag(option.value)).toBe(option.label)
    }
  })

  it('has no duplicate values', () => {
    const values = WORKSHOP_RESOLUTION_OPTIONS.map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('parseWorkshopResolution', () => {
  it('reads the size and Steam tag from the resolution tag', () => {
    expect(parseWorkshopResolution(['Wallpaper', 'Scene', '3840 x 2160'])).toEqual({
      width: 3840,
      height: 2160,
      label: '3840 x 2160',
    })
    expect(parseWorkshopResolution(['ultrawide 3440 x 1440'])).toEqual({
      width: 3440,
      height: 1440,
      label: 'Ultrawide 3440 x 1440',
    })
  })

  it('keeps the tag for resolutions without a size', () => {
    expect(parseWorkshopResolution(['Dynamic resolution'])).toEqual({
      width: 0,
      height: 0,
      label: 'Dynamic resolution',
    })
  })

  it('returns 0x0 without a label when the item has no resolution tag', () => {
    expect(parseWorkshopResolution(['Wallpaper', 'Nature'])).toEqual({ width: 0, height: 0 })
  })
})

describe('mapWorkshopItems', () => {
  it('carries the resolution onto each item', () => {
    const [item] = mapWorkshopItems([
      {
        publishedFileId: 1n,
        title: 'Test',
        owner: { steamId64: 2n },
        tags: ['Wallpaper', 'Scene', '2560 x 1440'],
      },
    ])

    expect(item.resolution).toEqual({ width: 2560, height: 1440, label: '2560 x 1440' })
  })
})
