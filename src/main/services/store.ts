import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/constants/app'
import type { ApplyWallpaperOptions, WallpaperOverrides, AgeRating } from '../../shared/constants/wallpaper'

// Store schemas
export interface ActivePlaylistInfo {
  name: string
  screen: string
}

export interface ActiveWallpapersSchema {
  activeWallpapers: Record<string, ApplyWallpaperOptions>
  activePlaylists: Record<string, ActivePlaylistInfo>
  activePlaylist: ActivePlaylistInfo | null
  // Wallpaper path -> last applied timestamp, drives the "recent" sort
  appliedHistory: Record<string, number>
}

export interface WallpaperOverridesSchema {
  overrides: Record<string, WallpaperOverrides>
}

export interface WorkshopMetadataSchema {
  // Steam workshop item id -> age rating, resolved from Steam UGC tags
  ageRatings: Record<string, AgeRating>
}

class StoreService {
  private static instance: StoreService | null = null

  readonly settings: Store<AppSettings>
  readonly activeWallpapers: Store<ActiveWallpapersSchema>
  readonly wallpaperOverrides: Store<WallpaperOverridesSchema>
  readonly workshopMetadata: Store<WorkshopMetadataSchema>

  private constructor() {
    this.settings = new Store<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    })

    this.activeWallpapers = new Store<ActiveWallpapersSchema>({
      name: 'active-wallpapers',
      defaults: {
        activeWallpapers: {},
        activePlaylists: {},
        activePlaylist: null,
        appliedHistory: {},
      },
    })

    this.wallpaperOverrides = new Store<WallpaperOverridesSchema>({
      name: 'wallpaper-overrides',
      defaults: {
        overrides: {},
      },
    })

    this.workshopMetadata = new Store<WorkshopMetadataSchema>({
      name: 'workshop-metadata',
      defaults: { ageRatings: {} },
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
