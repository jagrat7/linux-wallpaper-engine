import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt.labs.platform as Labs
import "."
import "pages"

ApplicationWindow {
    id: win
    visible: true
    width: 1280
    height: 800
    title: "Linux Wallpaper Engine"
    color: AppState.colors.bg

    property int navIndex: 0
    readonly property var navModel: [
        { label: "Library", icon: "🖼" },
        { label: "Displays", icon: "🖥" },
        { label: "Playlists", icon: "▶" },
        { label: "Workshop", icon: "🛒" },
        { label: "Settings", icon: "⚙" }
    ]

    Component.onCompleted: {
        AppState.init()
        if (AppState.settings && AppState.settings.minimizeOnStartup && AppState.settings.enableSystemTray)
            visibility = Window.Minimized
    }

    // Minimize-to-tray instead of closing when configured
    onClosing: function(close) {
        if (AppState.settings && AppState.settings.enableSystemTray && AppState.settings.minimizeOnClose && !_quitting) {
            close.accepted = false
            hide()
        }
    }
    property bool _quitting: false
    function quit() {
        _quitting = true
        Qt.quit()
    }

    Labs.SystemTrayIcon {
        id: trayIcon
        visible: AppState.settings ? !!AppState.settings.enableSystemTray : false
        tooltip: win.title
        menu: Labs.Menu {
            Labs.MenuItem {
                text: "Toggle App"
                onTriggered: {
                    if (win.visible) { if (win.visibility === Window.Minimized) win.showNormal(); else win.hide() }
                    else { win.show(); win.raise(); win.requestActivate() }
                }
            }
            Labs.MenuItem { text: "Quit"; onTriggered: win.quit() }
        }
        onActivated: function(reason) {
            if (reason === Labs.SystemTrayIcon.Trigger || reason === Labs.SystemTrayIcon.Context) return
            if (win.visible) { if (win.visibility === Window.Minimized) win.showNormal(); else win.hide() }
            else { win.show(); win.raise(); win.requestActivate() }
        }
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────
    Shortcut {
        sequence: "Esc"
        onActivated: {
            if (workshopPage.selected) workshopPage.selected = null
            else if (AppState.selectedWallpaper) AppState.selectedWallpaper = null
        }
    }
    Shortcut { sequence: "Ctrl+1"; onActivated: win.navIndex = 0 }
    Shortcut { sequence: "Ctrl+2"; onActivated: win.navIndex = 1 }
    Shortcut { sequence: "Ctrl+3"; onActivated: win.navIndex = 2 }
    Shortcut { sequence: "Ctrl+4"; onActivated: win.navIndex = 3 }
    Shortcut { sequence: "Ctrl+5"; onActivated: win.navIndex = 4 }

    // Palette for QtQuick.Controls
    palette.window: AppState.colors.bg
    palette.windowText: AppState.colors.fg
    palette.base: AppState.colors.card
    palette.text: AppState.colors.fg
    palette.button: AppState.colors.card
    palette.buttonText: AppState.colors.fg
    palette.highlight: AppState.colors.primary
    palette.highlightedText: AppState.colors.primaryFg
    palette.placeholderText: AppState.colors.mutedFg

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // ── Sidebar ──────────────────────────────────────────────────
        Rectangle {
            Layout.fillHeight: true
            width: 200
            color: AppState.colors.card
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 2
                Label {
                    text: "Wallpaper Engine"
                    font.bold: true
                    font.pixelSize: 15
                    color: AppState.colors.fg
                    Layout.fillWidth: true
                    Layout.bottomMargin: 12
                }
                Repeater {
                    model: win.navModel
                    delegate: Rectangle {
                        Layout.fillWidth: true
                        height: 40
                        radius: 8
                        color: win.navIndex === index ? AppState.colors.accent : "transparent"
                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            spacing: 10
                            Label { text: modelData.icon; font.pixelSize: 15 }
                            Label {
                                text: modelData.label
                                color: win.navIndex === index ? AppState.colors.accentFg : AppState.colors.fg
                                font.weight: win.navIndex === index ? Font.DemiBold : Font.Normal
                            }
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: win.navIndex = index
                        }
                    }
                }
                Item { Layout.fillHeight: true }
            }
        }

        // ── Content column ───────────────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            // Banners
            Rectangle {
                visible: AppState.updateInfo && AppState.updateInfo.hasUpdate && AppState.settings
                         && AppState.settings.dismissedUpdateVersion !== AppState.updateInfo.latestVersion
                Layout.fillWidth: true
                height: visible ? 40 : 0
                color: AppState.colors.accent
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 16
                    anchors.rightMargin: 8
                    Label {
                        text: "Update available: v" + (AppState.updateInfo ? AppState.updateInfo.latestVersion : "")
                        color: AppState.colors.accentFg
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "View"
                        onClicked: AppState.rpc("window.openExternal", { url: AppState.updateInfo.releaseUrl })
                    }
                    Button {
                        text: "Dismiss"
                        onClicked: AppState.updateSetting("dismissedUpdateVersion", AppState.updateInfo.latestVersion)
                    }
                }
            }

            Rectangle {
                visible: AppState.settings && !AppState.settings.dismissedScanReminder
                         && AppState.wallpapers.length > 0 && win.navIndex === 0
                Layout.fillWidth: true
                height: visible ? 40 : 0
                color: AppState.colors.accent
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 16
                    anchors.rightMargin: 8
                    Label {
                        text: "Scan your wallpapers to see Linux compatibility ratings"
                        color: AppState.colors.accentFg
                        Layout.fillWidth: true
                    }
                    Button { text: "Scan"; onClicked: { win.navIndex = 4; settingsPage.startScan() } }
                    Button { text: "Dismiss"; onClicked: AppState.updateSetting("dismissedScanReminder", true) }
                }
            }

            Rectangle {
                visible: !AppState.daemonConnected
                Layout.fillWidth: true
                height: visible ? 40 : 0
                color: AppState.colors.destructive
                Label {
                    anchors.centerIn: parent
                    text: "Backend daemon unreachable — retrying… (run `bun run daemon`)"
                    color: "#fff"
                }
            }

            StackLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                currentIndex: win.navIndex
                LibraryPage {}
                DisplaysPage {}
                PlaylistsPage {}
                WorkshopPage { id: workshopPage }
                SettingsPage { id: settingsPage }
            }

            // ── Status bar ───────────────────────────────────────────
            Rectangle {
                visible: AppState.settings ? !!AppState.settings.showStatusBar : true
                Layout.fillWidth: true
                height: 40
                color: AppState.colors.card

                readonly property var primary: AppState.primaryDisplay()
                readonly property var activeOnPrimary: {
                    var list = AppState.activeWallpapers
                    if (!list.length) return null
                    if (primary) {
                        for (var i = 0; i < list.length; i++)
                            if (list[i].screen === primary.name) return list[i]
                    }
                    return list[0]
                }
                readonly property var playlistHere: {
                    var a = activeOnPrimary
                    if (!a) return null
                    for (var i = 0; i < AppState.activePlaylists.length; i++)
                        if (AppState.activePlaylists[i].screen === a.screen) return AppState.activePlaylists[i]
                    return null
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    spacing: 12
                    Label {
                        text: "🖥 " + (parent.parent.primary ? parent.parent.primary.name : "No display")
                        color: AppState.colors.mutedFg
                        font.pixelSize: 12
                    }
                    Label {
                        visible: AppState.displays.length > 1
                        text: AppState.activeWallpapers.length + "/" + AppState.displays.length + " active"
                        color: AppState.colors.mutedFg
                        font.pixelSize: 11
                        padding: 4
                        background: Rectangle { color: AppState.colors.secondary; radius: 8 }
                    }
                    Rectangle { width: 1; height: 16; color: AppState.colors.border }
                    Label {
                        Layout.fillWidth: true
                        text: {
                            var a = parent.parent.activeOnPrimary
                            var p = parent.parent.playlistHere
                            if (p) return "▶ " + p.name
                            return a ? a.title : "No wallpaper"
                        }
                        color: AppState.colors.fg
                        font.pixelSize: 12
                        elide: Text.ElideRight
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                var bar = parent.parent
                                var a = bar.activeOnPrimary
                                if (!a) return
                                var parts = a.wallpaper.backgroundId.split("/").filter(function(s){return s.length})
                                var id = parts[parts.length - 1]
                                var w = AppState.wallpaperById(id)
                                if (w) { AppState.selectedWallpaper = w; win.navIndex = 0 }
                            }
                        }
                    }
                    Button {
                        text: AppState.settings && AppState.settings.silent ? "🔇" : "🔊"
                        flat: true
                        onClicked: AppState.updateSetting("silent", !(AppState.settings && AppState.settings.silent))
                    }
                    Button {
                        text: "■"
                        flat: true
                        enabled: !!parent.parent.activeOnPrimary
                        onClicked: {
                            var bar = parent.parent
                            var a = bar.activeOnPrimary
                            if (!a) return
                            if (bar.playlistHere) {
                                AppState.rpc("playlist.stop", { playlistName: bar.playlistHere.name, screen: a.screen }, function() {
                                    AppState.refreshActive(); AppState.refreshPlaylistsActive()
                                })
                            } else {
                                AppState.stopWallpaper(a.screen)
                            }
                        }
                    }
                }
            }
        }
    }
}
