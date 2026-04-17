import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import { settingsService } from '../settings'
import type { IWorkshopService } from './workshop.interface'
import type { WorkshopDiscoverResult, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import { createWorkshopConnectionError } from './workshop.errors'
import { buildRequiredTags, mapWorkshopItems, parseWorkshopId, shuffleDiscoverSectionConfigs, toSafeNumber } from './workshop.utils'
import { FIRST_PAGE, DISCOVER_PAGE, DISCOVER_SECTION_LIMIT, UGC_QUERY_TYPE_RANKED_BY_TREND, UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH, UGC_TYPE_ITEMS_READY_TO_USE, CURATED_DISCOVER_SECTION_CONFIGS, PINNED_DISCOVER_SECTION_CONFIGS } from '../../../shared/constants/workshop'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>
export type WorkshopConnectionEvent = 'connected' | 'disconnected'

const execFileAsync = promisify(execFile)
const AUTO_CONNECT_INTERVAL_MS = 3000

class WorkshopService implements IWorkshopService {
    private static instance: WorkshopService | null = null

    private client: SteamClient | null = null
    private clientPromise: Promise<SteamClient> | null = null
    private connectionEmitter = new EventEmitter()
    private autoConnectTimer: ReturnType<typeof setInterval> | null = null
    private subscriberCount = 0

    static getInstance(): WorkshopService {
        if (!WorkshopService.instance) {
            WorkshopService.instance = new WorkshopService()
        }

        return WorkshopService.instance
    }

    private async isSteamProcessRunning(): Promise<boolean> {
        for (const name of ['steam', 'steamwebhelper']) {
            try {
                const { stdout } = await execFileAsync('pgrep', ['-x', name])
                if (stdout.trim().length > 0) return true
            } catch {
                continue
            }
        }
        return false
    }

    subscribeToConnectionEvents(cb: (event: WorkshopConnectionEvent) => void): () => void {
        this.subscriberCount += 1
        this.connectionEmitter.on('connection', cb)

        if (!this.autoConnectTimer) {
            this.autoConnectTimer = setInterval(async () => {
                if (this.client || this.clientPromise) {
                    return
                }

                if (await this.isSteamProcessRunning()) {
                    try {
                        await this.getClient()
                    } catch {
                        // Steam running but init failed (not logged in, etc). Retry next tick.
                    }
                }
            }, AUTO_CONNECT_INTERVAL_MS)
        }

        return () => {
            this.connectionEmitter.off('connection', cb)
            this.subscriberCount = Math.max(this.subscriberCount - 1, 0)

            if (this.subscriberCount === 0 && this.autoConnectTimer) {
                clearInterval(this.autoConnectTimer)
                this.autoConnectTimer = null
            }
        }
    }

    async query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult> {
        const client = await this.getClient()
        const settings = await settingsService.loadSettings()
        const page = Math.max(options?.page ?? FIRST_PAGE, FIRST_PAGE)
        const search = options?.search?.trim()
        const requiredTags = buildRequiredTags(settings)

        const result = await client.workshop.getAllItems(
            page,
            search ? UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH : UGC_QUERY_TYPE_RANKED_BY_TREND,
            UGC_TYPE_ITEMS_READY_TO_USE,
            WALLPAPER_ENGINE_APP_ID,
            WALLPAPER_ENGINE_APP_ID,
            {
                searchText: search || undefined,
                matchAnyTag: requiredTags.length > 1 ? true : undefined,
                requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
                rankedByTrendDays: search ? undefined : 30,
                includeAdditionalPreviews: false,
                includeLongDescription: false,
                includeMetadata: true,
            },
        )

        const items = mapWorkshopItems(result.items, settings.filterType)

        return {
            items,
            page,
            totalResults: result.totalResults,
            returnedResults: result.returnedResults,
            hasNextPage: (page * result.returnedResults) < result.totalResults,
        }
    }

    async discover(): Promise<WorkshopDiscoverResult> {
        const client = await this.getClient()
        const settings = await settingsService.loadSettings()
        const sectionConfigs = [
            ...PINNED_DISCOVER_SECTION_CONFIGS,
            ...shuffleDiscoverSectionConfigs(CURATED_DISCOVER_SECTION_CONFIGS),
        ]

        const sections = await Promise.all(
            sectionConfigs.map(async (sectionConfig) => {
                const result = await client.workshop.getAllItems(
                    DISCOVER_PAGE,
                    sectionConfig.queryType,
                    UGC_TYPE_ITEMS_READY_TO_USE,
                    WALLPAPER_ENGINE_APP_ID,
                    WALLPAPER_ENGINE_APP_ID,
                    {
                        matchAnyTag: false,
                        requiredTags: buildRequiredTags(settings, sectionConfig.requiredTags),
                        rankedByTrendDays: sectionConfig.rankedByTrendDays,
                        includeAdditionalPreviews: false,
                        includeLongDescription: false,
                        includeMetadata: true,
                    },
                )

                return {
                    id: sectionConfig.id,
                    title: sectionConfig.title,
                    items: mapWorkshopItems(result.items, settings.filterType).slice(0, DISCOVER_SECTION_LIMIT),
                }
            }),
        )

        return {
            sections: sections.filter(section => section.items.length > 0),
        }
    }

    async subscribe(workshopId: string): Promise<boolean> {
        const workshopContext = await this.resolveWorkshopContext(workshopId)

        if (!workshopContext) {
            return false
        }

        try {
            await workshopContext.client.workshop.subscribe(workshopContext.itemId)
            workshopContext.client.workshop.download(workshopContext.itemId, true)
            return true
        } catch {
            return false
        }
    }

    async unsubscribe(workshopId: string): Promise<boolean> {
        const workshopContext = await this.resolveWorkshopContext(workshopId)

        if (!workshopContext) {
            return false
        }

        try {
            await workshopContext.client.workshop.unsubscribe(workshopContext.itemId)
            return true
        } catch {
            return false
        }
    }

    async itemStatus(workshopId: string): Promise<WorkshopStatus | null> {
        const workshopContext = await this.resolveWorkshopContext(workshopId)

        if (!workshopContext) {
            return null
        }

        const downloadInfo = workshopContext.client.workshop.downloadInfo(workshopContext.itemId)
        const installInfo = workshopContext.client.workshop.installInfo(workshopContext.itemId)

        if (!downloadInfo && !installInfo) {
            return null
        }

        return {
            path: installInfo?.folder ?? null,
            sizeOnDisk: installInfo ? toSafeNumber(installInfo.sizeOnDisk) : null,
            updatedAt: installInfo?.timestamp ?? null,
            download: downloadInfo
                ? {
                    current: toSafeNumber(downloadInfo.current),
                    total: toSafeNumber(downloadInfo.total),
                }
                : null,
        }
    }

    private async resolveWorkshopContext(workshopId: string): Promise<{ client: SteamClient; itemId: bigint } | null> {
        const itemId = parseWorkshopId(workshopId)

        if (itemId == null) {
            return null
        }

        try {
            const client = await this.getClient()
            return { client, itemId }
        } catch {
            return null
        }
    }

    private async getClient(): Promise<SteamClient> {
        if (this.client) {
            return this.client
        }

        if (this.clientPromise) {
            return this.clientPromise
        }

        this.clientPromise = import('steamworks.js')
            .then((steamworksModule) => {
                const client = steamworksModule.init(WALLPAPER_ENGINE_APP_ID)
                this.client = client
                this.connectionEmitter.emit('connection', 'connected')
                return client
            })
            .catch(() => {
                throw createWorkshopConnectionError('steam_not_running')
            })
            .finally(() => {
                this.clientPromise = null
            })

        return this.clientPromise
    }
}

export const workshopService = WorkshopService.getInstance()
