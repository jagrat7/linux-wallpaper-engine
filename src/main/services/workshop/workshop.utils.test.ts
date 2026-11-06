import { describe, expect, it } from 'vite-plus/test'
import { buildFilterCombinations } from './workshop.utils'

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
})
