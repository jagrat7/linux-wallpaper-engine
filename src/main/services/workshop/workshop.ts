import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import { WALLPAPER_ENGINE_APP_ID } from '../../../shared/constants/app'
import { settingsService } from '../settings'
import type { IWorkshopService, WorkshopConnectionStatus } from './workshop.interface'
import type { WorkshopDiscoverResult, WorkshopQueryOptions, WorkshopQueryResult, WorkshopStatus } from './workshop.types'
import { createWorkshopConnectionError, type WorkshopConnectionIssue } from './workshop.errors'
import { buildRequiredTags, mapWorkshopItems, parseWorkshopId, shuffleDiscoverSectionConfigs, toSafeNumber } from './workshop.utils'
import { FIRST_PAGE, DISCOVER_PAGE, DISCOVER_SECTION_LIMIT, UGC_QUERY_TYPE_RANKED_BY_TREND, UGC_QUERY_TYPE_RANKED_BY_TEXT_SEARCH, UGC_TYPE_ITEMS_READY_TO_USE, CURATED_DISCOVER_SECTION_CONFIGS, PINNED_DISCOVER_SECTION_CONFIGS } from '../../../shared/constants/workshop'

type SteamworksModule = typeof import('steamworks.js')
type SteamClient = ReturnType<SteamworksModule['init']>
export type WorkshopConnectionEvent = 'connected' | 'disconnected'

type SteamConnectionState =
    | { status: 'idle' }
    | { status: 'connecting' }
    | { status: 'connected'; client: SteamClient }
    | { status: 'disconnected'; reason: WorkshopConnectionIssue }
    | { status: 'user_disconnected' }

const execFileAsync = promisify(execFile)
const CONNECTION_MONITOR_INTERVAL_MS = 3000
const STEAM_SERVERS_DISCONNECTED_CALLBACK = 2

class WorkshopService implements IWorkshopService {
    private static instance: WorkshopService | null = null

    private connection: SteamConnectionState = { status: 'idle' }
    private clientPromise: Promise<SteamClient | null> | null = null
    private disconnectHandle: { disconnect(): void } | null = null
    private steamCallbacksInterval: ReturnType<typeof setInterval> | null = null
    private connectionEmitter = new EventEmitter()
    private connectionMonitor: ReturnType<typeof setInterval> | null = null
    private isRecoveryRunning = false
    private subscriberCount = 0

    static getInstance(): WorkshopService {
        if (!WorkshopService.instance) {
            WorkshopService.instance = new WorkshopService()
        }

        return WorkshopService.instance
    }

    getConnectionStatus(): WorkshopConnectionStatus {
        return this.connection.status
    }

    disconnect(): void {
        if (this.connection.status !== 'connected') {
            return
        }

        this.releaseSteamResources()
        this.connection = { status: 'user_disconnected' }
        this.connectionEmitter.emit('connection', 'disconnected')
    }

    async reconnect(): Promise<void> {
        if (this.connection.status === 'connected' || this.connection.status === 'connecting') {
            return
        }

        this.connection = { status: 'idle' }

        try {
            await this.getClient()
        } catch {
            // getClient will have transitioned to the appropriate disconnected state.
        }
    }

    subscribeToConnectionEvents(cb: (event: WorkshopConnectionEvent) => void): () => void {
        this.subscriberCount += 1
        this.connectionEmitter.on('connection', cb)
        this.startMonitor()

        return () => {
            this.connectionEmitter.off('connection', cb)
            this.subscriberCount = Math.max(this.subscriberCount - 1, 0)

            if (this.subscriberCount === 0) {
                this.stopMonitor()
            }
        }
    }

    async query(options?: WorkshopQueryOptions): Promise<WorkshopQueryResult> {
        // Get the Steam client instance, or return an empty result if unavailable.
        const client = await this.getClient()
        const settings = await settingsService.loadSettings()
        const page = Math.max(options?.page ?? FIRST_PAGE, FIRST_PAGE)
        const search = options?.search?.trim()
        const requiredTags = buildRequiredTags(settings)

        // Return an empty result when Steam is unavailable so the renderer can stay consistent.
        if (!client) {
            return {
                items: [],
                page,
                totalResults: 0,
                returnedResults: 0,
                hasNextPage: false,
            }
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

    private async resolveWorkshopContext(workshopId: string): Promise<{ client: SteamClient; itemId: bigint } | null> {
        const client = await this.getClient()
        const itemId = parseWorkshopId(workshopId)

        if (!client || itemId == null) {
            return null
        }

        return { client, itemId }
    }

    private async getClient(): Promise<SteamClient | null> {
        if (this.connection.status === 'connected') {
            return this.connection.client
        }

        if (this.clientPromise) {
            return this.clientPromise
        }

        if (this.connection.status === 'disconnected') {
            throw createWorkshopConnectionError(this.connection.reason)
        }

        if (this.connection.status === 'user_disconnected') {
            throw createWorkshopConnectionError('steam_unavailable')
        }

        this.connection = { status: 'connecting' }

        const isSteamRunning = await this.isSteamProcessRunning()

        if (!isSteamRunning) {
            this.connection = { status: 'disconnected', reason: 'steam_not_running' }
            throw createWorkshopConnectionError('steam_not_running')
        }

        this.clientPromise = import('steamworks.js')
            .then((steamworksModule) => {
                const client = this.initSteamClient(steamworksModule)

                this.disconnectHandle = client.callback.register(
                    STEAM_SERVERS_DISCONNECTED_CALLBACK,
                    () => this.handleDisconnect(),
                )

                this.connection = { status: 'connected', client }
                this.connectionEmitter.emit('connection', 'connected')
                return client
            })
            .catch(() => {
                this.connection = { status: 'disconnected', reason: 'steam_not_logged_in' }
                throw createWorkshopConnectionError('steam_not_logged_in')
            })
            .finally(() => {
                this.clientPromise = null
            })

        return this.clientPromise
    }

    // Temporarily monkey-patch setInterval to capture the runCallbacks interval ID
    // that steamworks.js creates internally. This lets us stop polling Steam on
    // disconnect so Steam can shut down without waiting for our app.
    private initSteamClient(steamworksModule: SteamworksModule): SteamClient {
        const originalSetInterval = globalThis.setInterval
        globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
            const id = originalSetInterval(...args)
            this.steamCallbacksInterval = id
            return id
        }) as typeof setInterval

        try {
            return steamworksModule.init(WALLPAPER_ENGINE_APP_ID)
        } finally {
            globalThis.setInterval = originalSetInterval
        }
    }

    private handleDisconnect(): void {
        this.releaseSteamResources()
        this.connection = { status: 'disconnected', reason: 'steam_not_running' }
        this.connectionEmitter.emit('connection', 'disconnected')
    }

    private releaseSteamResources(): void {
        this.disconnectHandle?.disconnect()
        this.disconnectHandle = null

        if (this.steamCallbacksInterval) {
            clearInterval(this.steamCallbacksInterval)
            this.steamCallbacksInterval = null
        }
    }

    private startMonitor(): void {
        if (this.connectionMonitor) {
            return
        }

        this.connectionMonitor = setInterval(() => {
            void this.tryRecover()
        }, CONNECTION_MONITOR_INTERVAL_MS)
    }

    private stopMonitor(): void {
        if (!this.connectionMonitor) {
            return
        }

        clearInterval(this.connectionMonitor)
        this.connectionMonitor = null
    }

    private async tryRecover(): Promise<void> {
        if (this.isRecoveryRunning || this.connection.status !== 'disconnected') {
            return
        }

        this.isRecoveryRunning = true

        try {
            const isSteamRunning = await this.isSteamProcessRunning()

            if (!isSteamRunning) {
                return
            }

            this.connection = { status: 'idle' }
            await this.getClient()
        } catch {
            // Recovery failed, will retry on next interval tick.
        } finally {
            this.isRecoveryRunning = false
        }
    }

    private async isSteamProcessRunning(): Promise<boolean> {
        const processChecks = [
            { command: 'pgrep', args: ['-x', 'steam'] },
            { command: 'pgrep', args: ['-x', 'steamwebhelper'] },
        ]

        for (const processCheck of processChecks) {
            try {
                const { stdout } = await execFileAsync(processCheck.command, processCheck.args)

                if (stdout.trim().length > 0) {
                    return true
                }
            } catch {
                continue
            }
        }

        return false
    }
}

export const workshopService = WorkshopService.getInstance()
