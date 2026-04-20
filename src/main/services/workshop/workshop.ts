import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import { settingsService } from '../settings'
import type { IWorkshopService } from './workshop.interface'
import type { WorkshopDiscoverOptions, WorkshopDiscoverResult, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import { createWorkshopConnectionError } from './workshop.errors'
import { buildFilterCombinations, mapWorkshopItems, mergeWorkshopItemsBySource, parseWorkshopId, shuffleDiscoverSectionConfigs, toSafeNumber } from './workshop.utils'
import { decodeWorkshopCursor } from '../../../shared/utils/workshop-cursor'
import { DISCOVER_PAGE, DISCOVER_SECTION_LIMIT, UGC_QUERY_TYPE_RANKED_BY_TREND, UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH, UGC_TYPE_ITEMS_READY_TO_USE, CURATED_DISCOVER_SECTION_CONFIGS, PINNED_DISCOVER_SECTION_CONFIGS, WORKSHOP_SORT_TO_QUERY_TYPE, WORKSHOP_TREND_DAYS, WORKSHOP_MAX_RESULTS } from '../../../shared/constants/workshop'

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
        const page = decodeWorkshopCursor(options?.cursor)
        const search = options?.search?.trim()
        const sortBy = options?.sortBy ?? settings.workshopSortBy
        const sortedQueryType = WORKSHOP_SORT_TO_QUERY_TYPE[sortBy] ?? UGC_QUERY_TYPE_RANKED_BY_TREND
        const queryType = search ? UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH : sortedQueryType

        // One Steam query per (type, ageRating) combination. AND within a combo, OR across combos.
        // This keeps filtering fully server-side (no post-filter) and gives a stable result set per unique query.
        const combinations = buildFilterCombinations(settings)
        const results = await Promise.all(
            combinations.map(requiredTags =>
                client.workshop.getAllItems(
                    page,
                    queryType,
                    UGC_TYPE_ITEMS_READY_TO_USE,
                    WALLPAPER_ENGINE_APP_ID,
                    WALLPAPER_ENGINE_APP_ID,
                    {
                        searchText: search || undefined,
                        matchAnyTag: false,
                        requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
                        rankedByTrendDays: queryType === UGC_QUERY_TYPE_RANKED_BY_TREND ? WORKSHOP_TREND_DAYS : undefined,
                        includeAdditionalPreviews: false,
                        includeLongDescription: false,
                        includeMetadata: true,
                    },
                ),
            ),
        )

        const mergedRawItems = mergeWorkshopItemsBySource(results.map(result => result.items))

        const items = mapWorkshopItems(mergedRawItems)
        // Sum is a slight over-count when combos overlap, but Steam's cap clamps it below the UI pagination ceiling.
        const totalResults = results.reduce((sum, result) => sum + result.totalResults, 0)
        const cappedTotalResults = Math.min(totalResults, WORKSHOP_MAX_RESULTS)
        const returnedResults = items.length
        const anyCombinationHasMore = results.some(result => (page * result.returnedResults) < result.totalResults)
        const hasNextPage = anyCombinationHasMore && (page * returnedResults) < cappedTotalResults

        return {
            items,
            page,
            totalResults: cappedTotalResults,
            returnedResults,
            hasNextPage,
        }
    }

    async discover(options?: WorkshopDiscoverOptions): Promise<WorkshopDiscoverResult> {
        const client = await this.getClient()
        const settings = await settingsService.loadSettings()
        const sortBy = options?.sortBy ?? settings.workshopSortBy
        const sortedQueryType = WORKSHOP_SORT_TO_QUERY_TYPE[sortBy]
        const sectionConfigs = [
            ...PINNED_DISCOVER_SECTION_CONFIGS,
            ...shuffleDiscoverSectionConfigs(CURATED_DISCOVER_SECTION_CONFIGS),
        ]

        const sections = await Promise.all(
            sectionConfigs.map(async (sectionConfig) => {
                // Pinned sections (Trending, New) keep their defining query.
                // Curated category sections follow the user-selected sort so the order is consistent.
                const isPinned = PINNED_DISCOVER_SECTION_CONFIGS.some(pinned => pinned.id === sectionConfig.id)
                const queryType = isPinned || !sortedQueryType ? sectionConfig.queryType : sortedQueryType
                const rankedByTrendDays = queryType === UGC_QUERY_TYPE_RANKED_BY_TREND
                    ? (sectionConfig.rankedByTrendDays ?? WORKSHOP_TREND_DAYS)
                    : undefined

                // Section's own required tags become baseTags for the combinator, then type/age axes fan out into combos.
                const combinations = buildFilterCombinations(settings, sectionConfig.requiredTags)
                const results = await Promise.all(
                    combinations.map(requiredTags =>
                        client.workshop.getAllItems(
                            DISCOVER_PAGE,
                            queryType,
                            UGC_TYPE_ITEMS_READY_TO_USE,
                            WALLPAPER_ENGINE_APP_ID,
                            WALLPAPER_ENGINE_APP_ID,
                            {
                                matchAnyTag: false,
                                requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
                                rankedByTrendDays,
                                includeAdditionalPreviews: false,
                                includeLongDescription: false,
                                includeMetadata: true,
                            },
                        ),
                    ),
                )

                const mergedRawItems = mergeWorkshopItemsBySource(
                    results.map(result => result.items),
                    DISCOVER_SECTION_LIMIT,
                )

                return {
                    id: sectionConfig.id,
                    title: sectionConfig.title,
                    items: mapWorkshopItems(mergedRawItems).slice(0, DISCOVER_SECTION_LIMIT),
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
