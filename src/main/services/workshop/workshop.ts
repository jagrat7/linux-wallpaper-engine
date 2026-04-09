import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import type { IWorkshopService } from './workshop.interface'
import type { WorkshopItem, WorkshopStatus } from './workshop.types'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>

class WorkshopService implements IWorkshopService {
  private static instance: WorkshopService | null = null

  private client: SteamClient | null = null
  private clientPromise: Promise<SteamClient | null> | null = null
  private initAttempted = false

  static getInstance(): WorkshopService {
    if (!WorkshopService.instance) {
      WorkshopService.instance = new WorkshopService()
    }

    return WorkshopService.instance
  }

  async query(search?: string): Promise<WorkshopItem[]> {
    const client = await this.getClient()

    if (!client) {
      return []
    }

    const subscribedItems = client.workshop.getSubscribedItems()

    if (subscribedItems.length === 0) {
      return []
    }

    const result = await client.workshop.getItems(subscribedItems, {
      includeLongDescription: false,
      includeMetadata: true,
    })

    const normalizedSearch = search?.trim().toLowerCase()

    return result.items
      .filter((item): item is NonNullable<(typeof result.items)[number]> => item != null)
      .map(item => ({
        id: item.publishedFileId.toString(),
        title: item.title,
        author: item.owner.steamId32,
        tags: item.tags,
        previewUrl: item.previewUrl ?? undefined,
      }))
      .filter(item => {
        if (!normalizedSearch) {
          return true
        }

        return item.title.toLowerCase().includes(normalizedSearch) ||
          item.author.toLowerCase().includes(normalizedSearch) ||
          item.tags.some(tag => tag.toLowerCase().includes(normalizedSearch))
      })
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }))
  }

  async subscribe(workshopId: string): Promise<boolean> {
    const client = await this.getClient()
    const itemId = this.parseWorkshopId(workshopId)

    if (!client || itemId == null) {
      return false
    }

    try {
      await client.workshop.subscribe(itemId)
      return true
    } catch {
      return false
    }
  }

  async unsubscribe(workshopId: string): Promise<boolean> {
    const client = await this.getClient()
    const itemId = this.parseWorkshopId(workshopId)

    if (!client || itemId == null) {
      return false
    }

    try {
      await client.workshop.unsubscribe(itemId)
      return true
    } catch {
      return false
    }
  }

  async status(workshopId: string): Promise<WorkshopStatus | null> {
    const client = await this.getClient()
    const itemId = this.parseWorkshopId(workshopId)

    if (!client || itemId == null) {
      return null
    }

    const installInfo = client.workshop.installInfo(itemId)

    if (!installInfo) {
      return null
    }

    return {
      path: installInfo.folder,
      sizeOnDisk: this.toSafeNumber(installInfo.sizeOnDisk),
      updatedAt: installInfo.timestamp,
    }
  }

  private async getClient(): Promise<SteamClient | null> {
    if (this.client) {
      return this.client
    }

    if (this.clientPromise) {
      return this.clientPromise
    }

    if (this.initAttempted) {
      return null
    }

    this.initAttempted = true

    this.clientPromise = import('steamworks.js')
      .then((steamworksModule) => {
        this.client = steamworksModule.init(WALLPAPER_ENGINE_APP_ID)
        return this.client
      })
      .catch(() => {
        this.client = null
        return null
      })
      .finally(() => {
        this.clientPromise = null
      })

    return this.clientPromise
  }

  private parseWorkshopId(workshopId: string): bigint | null {
    const normalizedId = workshopId.trim()

    if (!/^\d+$/.test(normalizedId)) {
      return null
    }

    try {
      return BigInt(normalizedId)
    } catch {
      return null
    }
  }

  private toSafeNumber(value: bigint): number {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER
    }

    return Number(value)
  }
}

export const workshopService = WorkshopService.getInstance()
