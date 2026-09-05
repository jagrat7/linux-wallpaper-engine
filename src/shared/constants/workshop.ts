
import type { DiscoverSectionConfig } from '../../main/services/workshop/workshop.types'


// Steam Workshop pagination starts at page 1.
export const FIRST_PAGE = 1
// Discover sections use the first page because they are curated previews, not full paginated feeds.
export const DISCOVER_PAGE = 1
// Each discover section stays compact so the default page can load several categories in parallel.
export const DISCOVER_SECTION_LIMIT = 12
// Steam UGC query types (subset used by the app).
export const UGC_QUERY_TYPE_RANKED_BY_VOTE = 0
export const UGC_QUERY_TYPE_RANKED_BY_PUBLICATION_DATE = 1
export const UGC_QUERY_TYPE_RANKED_BY_TREND = 3
export const UGC_QUERY_TYPE_RANKED_BY_VOTES_UP = 10
export const UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH = 11
export const UGC_QUERY_TYPE_RANKED_BY_TOTAL_UNIQUE_SUBSCRIPTIONS = 12
export const UGC_QUERY_TYPE_RANKED_BY_LAST_UPDATED_DATE = 19
// Restrict results to Workshop items that are ready to be used by the app.
export const UGC_TYPE_ITEMS_READY_TO_USE = 2

// Default window used by trend-based queries so results emphasize the last month.
export const WORKSHOP_TREND_DAYS = 30

// Steam Workshop UGC queries are capped server-side; paging past this returns k_EResultLimitExceeded.
// We clamp the results surfaced to the UI so pagination never offers an unreachable page.
export const WORKSHOP_MAX_RESULTS = 50000

// Steam EItemState bitmask flags returned by workshop.state()
// https://partner.steamgames.com/doc/api/ISteamUGC#EItemState
export const ITEM_STATE_SUBSCRIBED = 1
export const ITEM_STATE_INSTALLED = 4
export const ITEM_STATE_NEEDS_UPDATE = 8

// Number of Steam UGC pages we fetch in parallel per UI page. Bigger = fewer UI pages, more items
// per request. Steam returns up to ~50 items per page, so a batch of 5 yields ~250 items per UI page.
export const WORKSHOP_PAGE_BATCH_SIZE = 5

export const WORKSHOP_SORT_OPTIONS = [
    { label: 'Trending', value: 'trend' },
    { label: 'Most Popular', value: 'votes' },
    { label: 'Most Subscribed', value: 'subscriptions' },
    { label: 'Newest', value: 'date' },
    { label: 'Recently Updated', value: 'updated' },
] as const
export type WorkshopSortBy = typeof WORKSHOP_SORT_OPTIONS[number]['value']

export const WORKSHOP_SORT_TO_QUERY_TYPE: Record<WorkshopSortBy, number> = {
    trend: UGC_QUERY_TYPE_RANKED_BY_TREND,
    votes: UGC_QUERY_TYPE_RANKED_BY_VOTES_UP,
    subscriptions: UGC_QUERY_TYPE_RANKED_BY_TOTAL_UNIQUE_SUBSCRIPTIONS,
    date: UGC_QUERY_TYPE_RANKED_BY_PUBLICATION_DATE,
    updated: UGC_QUERY_TYPE_RANKED_BY_LAST_UPDATED_DATE,
}



export const PINNED_DISCOVER_SECTION_CONFIGS: DiscoverSectionConfig[] = [
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
]

export const DEFAULT_FAVORITE_DISCOVER_SECTION_IDS = PINNED_DISCOVER_SECTION_CONFIGS.map((sectionConfig) => sectionConfig.id)

export const CURATED_DISCOVER_SECTION_CONFIGS: DiscoverSectionConfig[] = [
    {
        id: 'anime',
        title: 'Anime',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Anime'],
        rankedByTrendDays: 30,
    },
    {
        id: 'nature',
        title: 'Nature',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Nature'],
        rankedByTrendDays: 30,
    },
    {
        id: 'cyberpunk',
        title: 'Cyberpunk',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Cyberpunk'],
        rankedByTrendDays: 30,
    },
    {
        id: 'relaxing',
        title: 'Relaxing',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Relaxing'],
        rankedByTrendDays: 30,
    },
    {
        id: 'abstract',
        title: 'Abstract',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Abstract'],
        rankedByTrendDays: 30,
    },
    {
        id: 'sci-fi',
        title: 'Sci-Fi',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Sci-Fi'],
        rankedByTrendDays: 30,
    },
    {
        id: 'fantasy',
        title: 'Fantasy',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Fantasy'],
        rankedByTrendDays: 30,
    },
    {
        id: 'landscape',
        title: 'Landscape',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Landscape'],
        rankedByTrendDays: 30,
    },
    {
        id: 'pixel-art',
        title: 'Pixel Art',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Pixel art'],
        rankedByTrendDays: 30,
    },
    {
        id: 'retro',
        title: 'Retro',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Retro'],
        rankedByTrendDays: 30,
    },
    {
        id: 'music',
        title: 'Music',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Music'],
        rankedByTrendDays: 30,
    },
    {
        id: 'technology',
        title: 'Technology',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Technology'],
        rankedByTrendDays: 30,
    },
    {
        id: 'game',
        title: 'Game',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Game'],
        rankedByTrendDays: 30,
    },
    {
        id: 'animal',
        title: 'Animal',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Animal'],
        rankedByTrendDays: 30,
    },
    {
        id: 'cartoon',
        title: 'Cartoon',
        queryType: UGC_QUERY_TYPE_RANKED_BY_TREND,
        requiredTags: ['Cartoon'],
        rankedByTrendDays: 30,
    },
]