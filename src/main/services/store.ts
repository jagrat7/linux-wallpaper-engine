import Store from 'electron-store'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ApplyWallpaperOptions,
  type WallpaperOverrides,
} from '../../shared/constants'

// Store schemas
export interface ActivePlaylistInfo {
  name: string
  screen: string
}

export interface ActiveWallpapersSchema {
  activeWallpapers: Record<string, ApplyWallpaperOptions>
  activePlaylist: ActivePlaylistInfo | null
}

export interface WallpaperOverridesSchema {
  overrides: Record<string, WallpaperOverrides>
}

class StoreService {
  private static instance: StoreService | null = null

  readonly settings: Store<AppSettings>
  readonly activeWallpapers: Store<ActiveWallpapersSchema>
  readonly wallpaperOverrides: Store<WallpaperOverridesSchema>

  private constructor() {
    this.settings = new Store<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    })

    this.activeWallpapers = new Store<ActiveWallpapersSchema>({
      name: 'active-wallpapers',
      defaults: {
        activeWallpapers: {},
        activePlaylist: null,
      },
    })

    this.wallpaperOverrides = new Store<WallpaperOverridesSchema>({
      name: 'wallpaper-overrides',
      defaults: {
        overrides: {},
      },
    })
  }

  static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService()
    }
    return StoreService.instance
  }
}

export const storeService = StoreService.getInstance()
