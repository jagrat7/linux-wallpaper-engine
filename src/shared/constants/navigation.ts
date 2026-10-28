export const APP_PAGE_ROUTES = {
  installed: '/',
  workshop: '/workshop',
  playlists: '/playlists',
  displays: '/displays',
  settings: '/settings',
} as const

export type AppPage = keyof typeof APP_PAGE_ROUTES
