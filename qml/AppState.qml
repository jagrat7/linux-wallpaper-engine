pragma Singleton
import QtQuick
import "js/api.js" as Api

QtObject {
    id: state

    // ── Connection ─────────────────────────────────────────────────────
    property bool daemonConnected: false
    property int _eventSeq: 0

    // ── Backend data ───────────────────────────────────────────────────
    property var settings: null
    property var wallpapers: []
    property bool wallpapersLoaded: false
    property var activeWallpapers: []
    property var activePlaylists: []
    property var displays: []
    property var compatibilityMap: ({})
    property bool backendInstalled: false
    property string sessionType: ""
    property int maxRefreshRate: 60
    property var systemTheme: null
    property var updateInfo: null
    property bool isFlatpak: false
    property var scanProgress: null
    property var scanReport: []
    property var playlists: []

    // ── UI selection state ─────────────────────────────────────────────
    property var selectedWallpaper: null
    property var selectedWorkshopItem: null
    property string librarySearch: ""

    // ── Signals ────────────────────────────────────────────────────────
    signal workshopConnectionEvent(var data)
    signal libraryRefreshRequested()

    // ── Theme ──────────────────────────────────────────────────────────
    readonly property var paletteDark: ({
        scheme: "dark", bg: "#0f1219", surface: "#151b27", card: "#1c2433",
        fg: "#e6eaf5", cardFg: "#e6eaf5", primary: "#7aa2f7", primaryFg: "#0d1119",
        primarySoft: "#2e7aa2f7", secondary: "#232c3f", secondaryFg: "#cdd6ea",
        muted: "#1c2433", mutedFg: "#8b94ab", accent: "#232c3f",
        accentFg: "#e6eaf5", destructive: "#f7768e", border: "#2a3448",
        success: "#9ece6a", warning: "#e0af68", chip: "#b3000000"
    })
    readonly property var paletteLight: ({
        scheme: "light", bg: "#f3f5f9", surface: "#eaeef5", card: "#ffffff",
        fg: "#1c2331", cardFg: "#1c2331", primary: "#4c6ef5", primaryFg: "#ffffff",
        primarySoft: "#1f4c6ef5", secondary: "#e6eaf1", secondaryFg: "#1c2331",
        muted: "#eef1f7", mutedFg: "#667085", accent: "#e6eaf1",
        accentFg: "#1c2331", destructive: "#dc2626", border: "#dbe0ea",
        success: "#16a34a", warning: "#d97706", chip: "#b3000000"
    })
    readonly property var paletteSteam: ({
        scheme: "dark", bg: "#1b2838", surface: "#16202d", card: "#22303f",
        fg: "#c7d5e0", cardFg: "#c7d5e0", primary: "#66c0f4", primaryFg: "#171d25",
        primarySoft: "#3366c0f4", secondary: "#2a475e", secondaryFg: "#c7d5e0",
        muted: "#1f2c3a", mutedFg: "#8f98a0", accent: "#2a475e",
        accentFg: "#c7d5e0", destructive: "#c94b4b", border: "#2a475e",
        success: "#5c7e10", warning: "#b8a34a", chip: "#b3000000"
    })
    readonly property var paletteHardLight: ({
        scheme: "light", bg: "#ffffff", surface: "#f0f0f0", card: "#ffffff",
        fg: "#000000", cardFg: "#000000", primary: "#0000ee", primaryFg: "#ffffff",
        primarySoft: "#200000ee", secondary: "#e8e8e8", secondaryFg: "#000000",
        muted: "#f0f0f0", mutedFg: "#333333", accent: "#d0d0d0",
        accentFg: "#000000", destructive: "#cc0000", border: "#888888",
        success: "#006600", warning: "#996600", chip: "#b3000000"
    })

    // Resolved color set. theme=system follows the OS color scheme live via
    // Qt.styleHints (signal-driven), falling back to the daemon's detection;
    // the daemon's richer palette is still merged in when available.
    readonly property var colors: {
        var themeName = settings ? settings.theme : "dark"
        if (themeName === "system") {
            var scheme = Qt.styleHints.colorScheme === Qt.ColorScheme.Light ? "light"
                       : Qt.styleHints.colorScheme === Qt.ColorScheme.Dark ? "dark"
                       : (systemTheme && systemTheme.scheme) || "dark"
            var base = scheme === "light" ? paletteLight : paletteDark
            var p = (systemTheme && systemTheme.palette) || null
            if (!p) return base
            var merged = {}
            for (var k in base) merged[k] = base[k]
            var map = {
                background: "bg", foreground: "fg", card: "card",
                cardForeground: "cardFg", primary: "primary",
                primaryForeground: "primaryFg", secondary: "secondary",
                secondaryForeground: "secondaryFg", muted: "muted",
                mutedForeground: "mutedFg", accent: "accent",
                accentForeground: "accentFg", destructive: "destructive",
                border: "border", success: "success", warning: "warning"
            }
            for (var sk in map) if (p[sk]) merged[map[sk]] = p[sk]
            return merged
        }
        if (themeName === "light") return paletteLight
        if (themeName === "steam") return paletteSteam
        if (themeName === "hard-light") return paletteHardLight
        return paletteDark
    }
    readonly property bool dark: colors.scheme === "dark"

    function compatColor(status) { return Api.COMPAT_COLORS[status || "unknown"] || Api.COMPAT_COLORS.unknown }
    function compatLabel(status) { return Api.COMPAT_LABELS[status || "unknown"] || "Unknown" }
    function typeLabel(t) { return Api.TYPE_LABELS[t] || t || "Unknown" }
    function fileUrl(p) { return Api.fileUrl(p) }
    function workshopCursor(page) { return Api.workshopCursor(page) }

    // ── RPC wrapper ────────────────────────────────────────────────────
    function rpc(path, input, onOk, onErr) {
        Api.rpc(path, input, onOk, onErr)
    }

    function updateSettings(patch, onOk) {
        Api.rpc("settings.update", patch, function(res) {
            settings = res
            if (onOk) onOk(res)
        })
    }

    function updateSetting(key, value, onOk) {
        var patch = {}
        patch[key] = value
        updateSettings(patch, onOk)
    }

    // ── Boot + event loop ──────────────────────────────────────────────
    function init() {
        // Allow `--daemon=<url>` on the command line to point at another host.
        var args = Qt.application.arguments
        for (var i = 0; i < args.length; i++) {
            if (args[i].indexOf("--daemon=") === 0) Api.setBase(args[i].substring(9))
        }
        pollEvents()
        refreshAll()
        pollTimer.start()
        healthTimer.start()
    }

    property Timer pollTimer: Timer {
        interval: 5000
        repeat: true
        onTriggered: {
            refreshActive()
            refreshPlaylistsActive()
            refreshScanProgress()
        }
    }

    // Slow health check: picks the daemon back up if it (re)starts.
    property Timer healthTimer: Timer {
        interval: 3000
        repeat: true
        onTriggered: Api.health(function() {
            if (!daemonConnected) {
                daemonConnected = true
                refreshAll()
            }
        }, function() {
            daemonConnected = false
        })
    }

    function pollEvents() {
        Api.pollEvents(_eventSeq, function(events, latest) {
            _eventSeq = latest
            for (var i = 0; i < events.length; i++) handleEvent(events[i].type, events[i].data)
            pollEvents()
        }, function() {
            eventRetryTimer.start()
        })
    }

    property Timer eventRetryTimer: Timer {
        interval: 3000
        onTriggered: pollEvents()
    }

    function handleEvent(type, data) {
        if (type === "invalidation") {
            if (data === "wallpaper.getWallpapers") refreshWallpapers()
            else if (data === "wallpaper.getCompatibilityMap") refreshCompatibility()
            else if (data === "wallpaper.applied" || data === "wallpaper.stopped") refreshActive()
            else if (data === "display.list") refreshDisplays()
            else if (data === "settings.systemTheme") refreshSystemTheme()
        } else if (type === "workshop-connection") {
            workshopConnectionEvent(data)
        }
    }

    // ── Data loading ───────────────────────────────────────────────────
    function refreshAll() {
        Api.rpc("settings.get", undefined, function(r) { settings = r })
        Api.rpc("settings.isFlatpak", undefined, function(r) { isFlatpak = r.isFlatpak })
        Api.rpc("settings.systemTheme", undefined, function(r) { systemTheme = r })
        Api.rpc("wallpaper.checkBackend", undefined, function(r) { backendInstalled = r.installed })
        Api.rpc("app.checkUpdate", undefined, function(r) { updateInfo = r })
        Api.rpc("display.session", undefined, function(r) { sessionType = r.type })
        Api.rpc("display.maxRefreshRate", undefined, function(r) { maxRefreshRate = r.maxRefreshRate })
        refreshWallpapers()
        refreshActive()
        refreshDisplays()
        refreshCompatibility()
        refreshPlaylists()
        refreshPlaylistsActive()
        refreshScanProgress()
        refreshScanReport()
    }

    function refreshWallpapers() {
        Api.rpc("wallpaper.getWallpapers", undefined, function(r) {
            // Merge appliedHistory -> lastAppliedAt like the React renderer
            var list = r.wallpapers || []
            var hist = r.appliedHistory || {}
            for (var i = 0; i < list.length; i++) {
                if (list[i].path && hist[list[i].path]) list[i].lastAppliedAt = hist[list[i].path]
            }
            wallpapers = list
            wallpapersLoaded = true
            libraryRefreshRequested()
        }, function() { wallpapersLoaded = true })
    }

    function refreshActive() {
        Api.rpc("wallpaper.getActiveWallpaper", undefined, function(r) {
            activeWallpapers = r || []
        })
    }

    function refreshPlaylistsActive() {
        Api.rpc("playlist.active", undefined, function(r) {
            activePlaylists = r || []
        })
    }

    function refreshDisplays() {
        Api.rpc("display.list", undefined, function(r) {
            displays = r || []
        })
    }

    function refreshCompatibility() {
        Api.rpc("wallpaper.getCompatibilityMap", undefined, function(r) {
            compatibilityMap = r || {}
        })
    }

    function refreshSystemTheme() {
        Api.rpc("settings.systemTheme", undefined, function(r) { systemTheme = r })
    }

    function refreshPlaylists(cb) {
        Api.rpc("playlist.list", undefined, function(r) {
            playlists = r || []
            if (cb) cb(playlists)
        })
    }

    function refreshScanProgress() {
        Api.rpc("wallpaper.getScanProgress", undefined, function(r) { scanProgress = r })
    }

    function refreshScanReport() {
        Api.rpc("wallpaper.getScanReport", undefined, function(r) { scanReport = r || [] })
    }

    // ── Wallpaper actions ──────────────────────────────────────────────
    function applyWallpaper(backgroundId, screen, cb) {
        var input = { backgroundId: backgroundId }
        if (screen) input.screen = screen
        Api.rpc("wallpaper.setWallpaper", input, function(res) {
            refreshActive()
            refreshPlaylistsActive()
            if (cb) cb(res)
        }, function(err) {
            if (cb) cb({ success: false, error: err.message })
        })
    }

    function stopWallpaper(screens, cb) {
        Api.rpc("wallpaper.stopWalpaper", { screen: screens }, function(res) {
            refreshActive()
            refreshPlaylistsActive()
            if (cb) cb(res)
        }, function(err) {
            if (cb) cb({ success: false, error: err.message })
        })
    }

    function compatOf(wallpaper) {
        if (!wallpaper) return "unknown"
        var p = wallpaper.path || wallpaper.id
        return compatibilityMap[p] || "unknown"
    }

    function wallpaperById(id) {
        for (var i = 0; i < wallpapers.length; i++) {
            var w = wallpapers[i]
            if (w.id === id || (w.path && w.path.split("/").pop() === id)) return w
        }
        return null
    }

    // ── Library filtering + sorting (client-side, mirrors the React app) ──
    function filteredWallpapers() {
        var s = settings
        var out = []
        var fType = (s && s.filterType) || []
        var fAge = (s && s.filterAgeRating) || []
        var fTags = (s && s.filterTags) || []
        var fRes = (s && s.filterResolution) || []
        var fCompat = (s && s.filterCompatibility) || []
        var query = librarySearch.trim().toLowerCase()

        for (var i = 0; i < wallpapers.length; i++) {
            var w = wallpapers[i]
            if (query) {
                var hay = (w.title || "") + " " + (w.author || "") + " " + (w.tags || []).join(" ")
                if (hay.toLowerCase().indexOf(query) < 0) continue
            }
            if (fType.length && fType.indexOf("all") < 0 && fType.indexOf(w.type) < 0) continue
            // Missing age rating passes the filter (same as React)
            if (fAge.length && w.ageRating && fAge.indexOf(w.ageRating) < 0) continue
            if (fTags.length) {
                var wt = w.tags || []
                var hit = false
                for (var t = 0; t < fTags.length; t++) if (wt.indexOf(fTags[t]) >= 0) { hit = true; break }
                if (!hit) continue
            }
            if (fRes.length) {
                var res = resolutionLabel(w.resolution)
                if (fRes.indexOf(res) < 0) continue
            }
            if (fCompat.length && fCompat.indexOf(compatOf(w)) < 0) continue
            out.push(w)
        }

        var sortBy = (s && s.sortBy) || "date"
        var desc = ((s && s.sortOrder) || "desc") === "desc"
        out.sort(function(a, b) {
            var comparison = 0
            if (sortBy === "name") comparison = (a.title || "").localeCompare(b.title || "")
            else if (sortBy === "size") comparison = (a.fileSize || 0) - (b.fileSize || 0)
            else if (sortBy === "recent") {
                var aa = a.lastAppliedAt || 0, ba = b.lastAppliedAt || 0
                comparison = aa === ba ? (a.dateAdded || 0) - (b.dateAdded || 0) : aa - ba
            }
            else comparison = (a.dateAdded || 0) - (b.dateAdded || 0)
            return desc ? -comparison : comparison
        })
        return out
    }

    function availableTags() {
        var seen = {}, out = []
        for (var i = 0; i < wallpapers.length; i++) {
            var tags = wallpapers[i].tags || []
            for (var t = 0; t < tags.length; t++) if (!seen[tags[t]]) { seen[tags[t]] = true; out.push(tags[t]) }
        }
        return out.sort()
    }

    function resolutionLabel(r) {
        return (r && r.width && r.height) ? r.width + "x" + r.height : "Unknown"
    }

    function availableResolutions() {
        var seen = {}, out = []
        for (var i = 0; i < wallpapers.length; i++) {
            var key = resolutionLabel(wallpapers[i].resolution)
            if (!seen[key]) { seen[key] = true; out.push(key) }
        }
        return out.sort()
    }

    function activeScreensFor(backgroundId) {
        var out = []
        for (var i = 0; i < activeWallpapers.length; i++) {
            if (activeWallpapers[i].wallpaper.backgroundId === backgroundId) out.push(activeWallpapers[i].screen)
        }
        return out
    }

    function playlistScreensFor(name) {
        var out = []
        for (var i = 0; i < activePlaylists.length; i++) {
            if (activePlaylists[i].name === name) out.push(activePlaylists[i].screen)
        }
        return out
    }

    function primaryDisplay() {
        for (var i = 0; i < displays.length; i++) if (displays[i].primary) return displays[i]
        return displays.length ? displays[0] : null
    }
}
