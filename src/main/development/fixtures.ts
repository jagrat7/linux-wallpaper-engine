import fs from 'node:fs/promises'
import path from 'node:path'
import {
  BACKEND_NOT_INSTALLED_ERROR_MESSAGE,
  type Wallpaper,
} from '../../shared/constants/wallpaper'
import { DEFAULT_PLAYLIST_SETTINGS } from '../../shared/constants/playlist'
import { DEFAULT_SETTINGS } from '../../shared/constants/app'
import { wallpaperService } from '../services/wallpaper/wallpaper'
import { playlistService } from '../services/playlists/playlist'
import { displayService } from '../services/display'
import { settingsService } from '../services/settings'
import { storeService } from '../services/store'
import { systemThemeService } from '../services/system-theme/system-theme'
import { workshopService } from '../services/workshop/workshop'
import { invalidationService } from '../services/invalidation'

export async function installFixtures(dataDirectory: string) {
  storeService.settings.clear()
  storeService.activeWallpapers.clear()
  storeService.wallpaperOverrides.clear()
  const wallpapers: Wallpaper[] = []
  for (const [index, title] of ['Aurora Coast', 'Paper Mountains', 'Night Orchard'].entries()) {
    const directory = path.join(dataDirectory, 'wallpapers', String(index + 1))
    await fs.mkdir(directory, { recursive: true })
    const thumbnail = path.join(directory, 'preview.svg')
    const color = ['#287a89', '#c27d53', '#685396'][index]
    await fs.writeFile(
      thumbnail,
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${color}"/><circle cx="460" cy="90" r="40" fill="#eed6a0"/><path d="M0 360V270L170 110L340 270L490 160L640 310V360" fill="#162e39"/><path d="M0 310L170 170L320 320L490 230L640 350V360H0" fill="#0e202a"/></svg>`,
    )
    await fs.writeFile(
      path.join(directory, 'project.json'),
      JSON.stringify({ title, type: 'scene', preview: 'preview.svg', general: { properties: {} } }),
    )
    wallpapers.push({
      id: String(index + 1),
      title,
      author: 'Development fixtures',
      type: index === 2 ? 'web' : 'scene',
      ageRating: 'g',
      thumbnail,
      previewUrl: thumbnail,
      resolution: { width: 1920, height: 1080 },
      fileSize: 4096,
      dateAdded: 1700000000000 + index,
      tags: ['Nature'],
      installed: true,
      path: directory,
    })
  }
  if (process.env.LWE_DEV_SCENARIO === 'empty') wallpapers.length = 0
  const displays = ['DP-1', 'HDMI-A-1'].map((name, index) => ({
    id: name,
    name,
    resolution: '1920x1080',
    width: 1920,
    height: 1080,
    x: index * 1920,
    y: 0,
    refreshRate: index === 0 ? 144 : 60,
    primary: index === 0,
    connected: true,
    degraded: false,
  }))
  Object.assign(displayService, {
    detectDisplays: async () => displays,
    getDisplaySession: async () => 'wayland' as const,
  } satisfies Pick<typeof displayService, 'detectDisplays' | 'getDisplaySession'>)
  Object.assign(systemThemeService, {
    getTheme: async () => ({ scheme: 'dark' as const, palette: null }),
  } satisfies Pick<typeof systemThemeService, 'getTheme'>)
  await settingsService.saveSettings({
    ...DEFAULT_SETTINGS,
    theme: 'dark',
    dismissedScanReminder: true,
    restoreLastWallpaper: false,
  })
  await fs.writeFile(
    path.join(dataDirectory, 'steam-config.json'),
    JSON.stringify({
      steamuser: {
        general: {
          playlists: wallpapers.length
            ? [
                {
                  name: 'Evening rotation',
                  items: wallpapers.map((wallpaper) => wallpaper.path),
                  settings: DEFAULT_PLAYLIST_SETTINGS,
                },
              ]
            : [],
        },
      },
    }),
  )

  let active: Awaited<ReturnType<typeof wallpaperService.query>>['active'] = []
  const appliedHistory: Record<string, number> = {}
  Object.assign(wallpaperService, {
    query: async () => ({
      wallpapers,
      active,
      appliedHistory,
      backendInstalled: process.env.LWE_DEV_SCENARIO !== 'missing-backend',
    }),
    catalog: async () => wallpapers,
    apply: async (target) => {
      if (process.env.LWE_DEV_SCENARIO === 'missing-backend')
        return { success: false, error: BACKEND_NOT_INSTALLED_ERROR_MESSAGE }
      if (target.kind !== 'wallpaper') return { success: true }
      const wallpaper = wallpapers.find((item) => item.path === target.options.backgroundId)
      if (!wallpaper) return { success: false, error: 'Fixture wallpaper not found' }
      const screens = target.options.screen
        ? [target.options.screen]
        : displays.map((display) => display.name)
      active = active.filter((item) => !screens.includes(item.screen))
      active.push(
        ...screens.map((screen) => ({
          screen,
          wallpaper: target.options,
          title: wallpaper.title,
          thumbnail: wallpaper.thumbnail,
        })),
      )
      appliedHistory[wallpaper.path] = Date.now()
      invalidationService.emit('wallpaper.applied')
      invalidationService.emit('wallpaper.getWallpapers')
      return { success: true, screens }
    },
    stop: async (screen) => {
      const screens = Array.isArray(screen)
        ? screen
        : screen
          ? [screen]
          : displays.map((display) => display.name)
      active = active.filter((item) => !screens.includes(item.screen))
      invalidationService.emit('wallpaper.stopped')
      return { success: true, screens }
    },
  } satisfies Pick<typeof wallpaperService, 'query' | 'catalog' | 'apply' | 'stop'>)
  Object.assign(playlistService, {
    startProcess: async (name, screens, stampLastApplied) => {
      const playlist = await playlistService.getPlaylist(name)
      if (!playlist) return { success: false, error: 'Playlist not found' }
      const wallpaper = wallpapers.find((item) => playlist.items.includes(item.path))
      if (!wallpaper) return { success: false, error: 'No installed wallpapers in playlist' }
      for (const screen of screens) {
        const result = await wallpaperService.apply({
          kind: 'wallpaper',
          options: { backgroundId: wallpaper.path, screen },
        })
        if (!result.success) return result
      }
      playlistService.setActivePlaylist(name, screens)
      if (stampLastApplied) await playlistService.stampLastApplied(name)
      return { success: true }
    },
  } satisfies Pick<typeof playlistService, 'startProcess'>)
  const unavailable = async (): Promise<never> => {
    throw workshopService.createConnectionError('steam_not_running')
  }
  Object.assign(workshopService, {
    query: unavailable,
    discover: unavailable,
    subscribe: unavailable,
    unsubscribe: unavailable,
    itemStatus: async () => null,
    subscribeToConnectionEvents: (callback) => {
      // Exercise the existing observable contract with a deterministic unavailable event.
      const timer = setTimeout(() => callback('disconnected'), 0)
      return () => clearTimeout(timer)
    },
  } satisfies Pick<
    typeof workshopService,
    | 'query'
    | 'discover'
    | 'subscribe'
    | 'unsubscribe'
    | 'itemStatus'
    | 'subscribeToConnectionEvents'
  >)
}
