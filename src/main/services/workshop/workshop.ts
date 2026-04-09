import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import type { IWorkshopService } from './workshop.interface'
import type { WorkshopItem, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>

const FIRST_PAGE = 1
const UGC_QUERY_TYPE_RANKED_BY_TREND = 3
const UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH = 11
const UGC_TYPE_ITEMS_READY_TO_USE = 2

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

  async query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult> {
    const client = await this.getClient()
    const page = Math.max(options?.page ?? FIRST_PAGE, FIRST_PAGE)
    const search = options?.search?.trim()

    if (!client) {
      return this.emptyQueryResult(page)
    }

    const result = await client.workshop.getAllItems(
      page,
      search ? UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH : UGC_QUERY_TYPE_RANKED_BY_TREND,
      UGC_TYPE_ITEMS_READY_TO_USE,
      WALLPAPER_ENGINE_APP_ID,
      WALLPAPER_ENGINE_APP_ID,
      {
        searchText: search || undefined,
        rankedByTrendDays: search ? undefined : 30,
        includeAdditionalPreviews: false,
        includeLongDescription: false,
        includeMetadata: true,
      },
    )

    const items = result.items
      .filter((item): item is NonNullable<(typeof result.items)[number]> => item != null)
      .map((item): WorkshopItem => ({
        id: item.publishedFileId.toString(),
        title: item.title,
        author: item.owner.steamId32,
        tags: item.tags,
        previewUrl: item.previewUrl ?? undefined,
      }))

    return {
      items,
      page,
      totalResults: result.totalResults,
      returnedResults: result.returnedResults,
      hasNextPage: (page * result.returnedResults) < result.totalResults,
    }
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

  private emptyQueryResult(page: number): WorkshopQueryResult {
    return {
      items: [],
      page,
      totalResults: 0,
      returnedResults: 0,
      hasNextPage: false,
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
