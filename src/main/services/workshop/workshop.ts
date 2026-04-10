import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import { settingsService } from '../settings'
import type { IWorkshopService } from './workshop.interface'
import type { WorkshopDiscoverResult, WorkshopItem, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import { AGE_RATINGS } from '../../../shared/constants/wallpaper'
import { matchesWallpaperTypeFilter, parseWorkshopAgeRating, parseWorkshopId, parseWorkshopType, toSafeNumber, toWorkshopResolutionTag } from './workshop.utils'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>
type SteamWorkshopPage = Awaited<ReturnType<SteamClient['workshop']['getAllItems']>>

// Steam Workshop pagination starts at page 1.
const FIRST_PAGE = 1
// Discover sections use the first page because they are curated previews, not full paginated feeds.
const DISCOVER_PAGE = 1
// Each discover section stays compact so the default page can load several categories in parallel.
const DISCOVER_SECTION_LIMIT = 12
// Steam's publication date query is useful for a "new" discover rail.
const UGC_QUERY_TYPE_RANKED_BY_PUBLICATION_DATE = 1
// Default browse mode uses Steam's trending ranking query.
const UGC_QUERY_TYPE_RANKED_BY_TREND = 3
// Search mode uses Steam's text-search ranking query.
const UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH = 11
// Restrict results to Workshop items that are ready to be used by the app.
const UGC_TYPE_ITEMS_READY_TO_USE = 2

type DiscoverSectionConfig = {
    id: string
    title: string
    queryType: number
    requiredTags?: string[]
    rankedByTrendDays?: number
}

const DISCOVER_SECTION_CONFIGS: DiscoverSectionConfig[] = [
    {
        id: 'trending',
        title: 'Trending',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        rankedByTrendDays: 30,
    },
    {
        id: 'new',
        title: 'New',
        queryType: UGC_QUERY_TYPE_RANKED_BY_PUBLICATION_DATE,
    },
    {
        id: 'scenes',
        title: 'Scenes',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Scene'],
        rankedByTrendDays: 30,
    },
    {
        id: 'videos',
        title: 'Videos',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Video'],
        rankedByTrendDays: 30,
    },
    {
        id: 'web',
        title: 'Web',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Web'],
        rankedByTrendDays: 30,
    },
    {
        id: 'applications',
        title: 'Applications',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Application'],
        rankedByTrendDays: 30,
    },
]

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

        // Return an empty discover payload when Steam is unavailable so the renderer can render fallback UI.
        if (!client) {
            return { sections: [] }
        }

        // Build each discover rail from a small curated Workshop query while preserving the shared app filters.
        const sections = await Promise.all(
            DISCOVER_SECTION_CONFIGS.map(async (sectionConfig) => {
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
        // Get the Steam client instance and validate the workshop ID.
        const client = await this.getClient()
        const itemId = parseWorkshopId(workshopId)

        // Reject invalid ids early before calling into Steam.
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
        // Get the Steam client instance and validate the workshop ID.
        const client = await this.getClient()
        const itemId = parseWorkshopId(workshopId)

        // Reject invalid ids early before calling into Steam.
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
        // Get the Steam client instance and validate the workshop ID.
        const client = await this.getClient()
        const itemId = parseWorkshopId(workshopId)

        // Status only exists for valid ids backed by an initialized Steam client.
        if (!client || itemId == null) {
            return null
        }

        const installInfo = client.workshop.installInfo(itemId)

        // A missing install record means the item is not currently available on disk.
        if (!installInfo) {
            return null
        }

        return {
            path: installInfo.folder,
            sizeOnDisk: toSafeNumber(installInfo.sizeOnDisk),
            updatedAt: installInfo.timestamp,
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
