import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import { settingsService } from '../settings'
import type { IWorkshopService } from './workshop.interface'
import type { DiscoverSectionConfig, WorkshopDiscoverResult, WorkshopItem, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import { AGE_RATINGS } from '../../../shared/constants/wallpaper'
import { matchesWallpaperTypeFilter, parseWorkshopAgeRating, parseWorkshopId, parseWorkshopType, toSafeNumber, toWorkshopResolutionTag } from './workshop.utils'
import { FIRST_PAGE, DISCOVER_PAGE, DISCOVER_SECTION_LIMIT, UGC_QUERY_TYPE_RANKED_BY_TREND, UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH, UGC_TYPE_ITEMS_READY_TO_USE, CURATED_DISCOVER_SECTION_CONFIGS, PINNED_DISCOVER_SECTION_CONFIGS } from '../../../shared/constants/workshop'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>
type SteamWorkshopPage = Awaited<ReturnType<SteamClient['workshop']['getAllItems']>>

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
        // Get the Steam client instance, or return an empty result if unavailable.
        const client = await this.getClient()
        const settings = await settingsService.loadSettings()
        const page = Math.max(options?.page ?? FIRST_PAGE, FIRST_PAGE)
        const search = options?.search?.trim()
        const requiredTags = this.buildRequiredTags(settings)

        // Return an empty result when Steam is unavailable so the renderer can stay consistent.
        if (!client) {
            return this.emptyQueryResult(page)
        }

        // Query Wallpaper Engine Workshop items with server-side tag filtering where possible.
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

        // Normalize the raw Steam items into the app's WorkshopItem shape, then apply type filtering.
        const items = this.mapWorkshopItems(result, settings)

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
            ...this.shuffleDiscoverSectionConfigs(CURATED_DISCOVER_SECTION_CONFIGS),
        ]

        // Return an empty discover payload when Steam is unavailable so the renderer can render fallback UI.
        if (!client) {
            return { sections: [] }
        }

        // Build each discover rail from a small curated Workshop query while preserving the shared app filters.
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
                        requiredTags: this.buildRequiredTags(settings, sectionConfig.requiredTags),
                        rankedByTrendDays: sectionConfig.rankedByTrendDays,
                        includeAdditionalPreviews: false,
                        includeLongDescription: false,
                        includeMetadata: true,
                    },
                )

                return {
                    id: sectionConfig.id,
                    title: sectionConfig.title,
                    items: this.mapWorkshopItems(result, settings).slice(0, DISCOVER_SECTION_LIMIT),
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

    async status(workshopId: string): Promise<WorkshopStatus | null> {
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

    private buildRequiredTags(settings: Awaited<ReturnType<typeof settingsService.loadSettings>>, baseTags: string[] = []): string[] {
        const customTags = settings.filterTags.map(tag => tag.trim()).filter(Boolean)
        const ageRatingTags = settings.filterAgeRating
            .map(value => AGE_RATINGS[value]?.workshopTag)
            .filter(Boolean)
        const resolutionTags = settings.filterResolution
            .map(value => toWorkshopResolutionTag(value))
            .filter((value): value is string => value != null)

        // Deduplicate all tag sources before sending them to Steam.
        return Array.from(new Set([...baseTags, ...customTags, ...ageRatingTags, ...resolutionTags]))
    }

    private shuffleDiscoverSectionConfigs(sectionConfigs: DiscoverSectionConfig[]): DiscoverSectionConfig[] {
        const shuffledConfigs = [...sectionConfigs]

        for (let index = shuffledConfigs.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1))
            const currentConfig = shuffledConfigs[index]

            shuffledConfigs[index] = shuffledConfigs[swapIndex]
            shuffledConfigs[swapIndex] = currentConfig
        }

        return shuffledConfigs
    }

    private async resolveWorkshopContext(workshopId: string): Promise<{ client: SteamClient; itemId: bigint } | null> {
        const client = await this.getClient()
        const itemId = parseWorkshopId(workshopId)

        if (!client || itemId == null) {
            return null
        }

        return { client, itemId }
    }

    private mapWorkshopItems(result: SteamWorkshopPage, settings: Awaited<ReturnType<typeof settingsService.loadSettings>>): WorkshopItem[] {
        return result.items
            .filter((item): item is NonNullable<(typeof result.items)[number]> => item != null)
            .map((item): WorkshopItem => ({
                id: item.publishedFileId.toString(),
                title: item.title,
                author: item.owner.steamId64.toString(),
                ageRating: parseWorkshopAgeRating(item.tags),
                type: parseWorkshopType(item.tags),
                tags: item.tags,
                previewUrl: item.previewUrl ?? undefined,
            }))
            .filter(item => matchesWallpaperTypeFilter(item.type, settings.filterType))
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
        // Reuse the initialized client whenever possible.
        if (this.client) {
            return this.client
        }

        // Reuse the in-flight initialization promise to avoid duplicate init attempts.
        if (this.clientPromise) {
            return this.clientPromise
        }

        // Stop retrying after a failed initialization during this process lifetime.
        if (this.initAttempted) {
            return null
        }

        this.initAttempted = true

        // Lazily initialize Steamworks so non-Steam environments fail gracefully.
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
}

export const workshopService = WorkshopService.getInstance()
