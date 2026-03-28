export const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Date Added', value: 'date' },
  { label: 'Size', value: 'size' },
  { label: 'Recent', value: 'recent' },
] as const
export type SortBy = typeof SORT_OPTIONS[number]['value']

export const SORT_ORDER_OPTIONS = [
  { label: 'Ascending', value: 'asc' },
  { label: 'Descending', value: 'desc' },
] as const
export type SortOrder = typeof SORT_ORDER_OPTIONS[number]['value']
