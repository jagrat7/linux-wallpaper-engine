export const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Steam', value: 'steam' },
  { label: 'System', value: 'system' },
  { label: 'Hard Light', value: 'hard-light' },
] as const
export type ThemeOption = typeof THEME_OPTIONS[number]['value']
