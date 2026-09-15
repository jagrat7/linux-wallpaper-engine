import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
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

    // Material style, driven live by the resolved palette (light/dark/system).
    // Note: the style owns Material.background on the window (it re-assigns
    // it when the theme flips), so the window background is an explicit item.
    Material.theme: AppState.dark ? Material.Dark : Material.Light
    Material.primary: AppState.colors.primary
    Material.accent: AppState.colors.primary
    Material.foreground: AppState.colors.fg
    Material.roundedScale: Material.MediumScale
    background: Rectangle { color: AppState.colors.bg }

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

    // Explicit fill so the app bg paints inside contentItem (also what the
    // grab harness captures — window-level color/background wouldn't show).
    Rectangle {
        anchors.fill: parent
        color: AppState.colors.bg
        RowLayout {
        anchors.fill: parent
        spacing: 0

        // ── Sidebar ──────────────────────────────────────────────────
        Rectangle {
            Layout.fillHeight: true
            width: 216
            color: AppState.colors.surface
            // right edge separator
            Rectangle {
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 1
                color: AppState.colors.border
            }
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 4

                // brand
                RowLayout {
                    Layout.fillWidth: true
                    Layout.bottomMargin: 14
                    spacing: 10
                    Rectangle {
                        width: 30; height: 30; radius: 9
                        color: AppState.colors.primary
                        Label {
                            anchors.centerIn: parent
                            text: "🖼"
                            font.pixelSize: 15
                        }
                    }
                    ColumnLayout {
                        spacing: 0
                        Label {
                            text: "Wallpaper Engine"
                            font.bold: true
                            font.pixelSize: 14
                            color: AppState.colors.fg
                        }
                        Label {
                            text: "for Linux"
                            font.pixelSize: 10
                            color: AppState.colors.mutedFg
                        }
                    }
                }

                Repeater {
                    model: win.navModel
                    delegate: Rectangle {
                        id: navItem
                        Layout.fillWidth: true
                        height: 38
                        radius: 10
                        readonly property bool active: win.navIndex === index
                        color: active ? AppState.colors.primarySoft
                             : (navHover.hovered ? AppState.colors.card : "transparent")
                        Behavior on color { ColorAnimation { duration: 100 } }

                        // accent indicator on the selected item
                        Rectangle {
                            visible: navItem.active
                            anchors.left: parent.left
                            anchors.verticalCenter: parent.verticalCenter
                            anchors.leftMargin: 6
                            width: 3; height: 16; radius: 2
                            color: AppState.colors.primary
                        }
                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 16
                            spacing: 10
                            Label { text: modelData.icon; font.pixelSize: 15 }
                            Label {
                                text: modelData.label
                                color: navItem.active ? AppState.colors.primary : AppState.colors.fg
                                font.weight: navItem.active ? Font.DemiBold : Font.Normal
                            }
                        }
                        HoverHandler { id: navHover }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: win.navIndex = index
                        }
                    }
                }
                Item { Layout.fillHeight: true }

                // daemon status footer
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Rectangle {
                        width: 8; height: 8; radius: 4
                        color: AppState.daemonConnected ? AppState.colors.success : AppState.colors.destructive
                    }
                    Label {
                        text: AppState.daemonConnected ? "Daemon connected" : "Daemon offline"
                        color: AppState.colors.mutedFg
                        font.pixelSize: 11
                    }
                }
            }
        }

        // ── Content column ───────────────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            // Banners — tonal rounded bars inset from the content edges
            Rectangle {
                visible: AppState.updateInfo && AppState.updateInfo.hasUpdate && AppState.settings
                         && AppState.settings.dismissedUpdateVersion !== AppState.updateInfo.latestVersion
                Layout.fillWidth: true
                Layout.leftMargin: 12
                Layout.rightMargin: 12
                Layout.topMargin: 10
                height: visible ? 44 : 0
                radius: 10
                color: AppState.colors.primarySoft
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 8
                    Label {
                        text: "Update available: v" + (AppState.updateInfo ? AppState.updateInfo.latestVersion : "")
                        color: AppState.colors.fg
                        font.weight: Font.DemiBold
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "View"
                        onClicked: AppState.rpc("window.openExternal", { url: AppState.updateInfo.releaseUrl })
                    }
                    Button {
                        text: "Dismiss"
                        flat: true
                        onClicked: AppState.updateSetting("dismissedUpdateVersion", AppState.updateInfo.latestVersion)
                    }
                }
            }

            Rectangle {
                visible: AppState.settings && !AppState.settings.dismissedScanReminder
                         && AppState.wallpapers.length > 0 && win.navIndex === 0
                Layout.fillWidth: true
                Layout.leftMargin: 12
                Layout.rightMargin: 12
                Layout.topMargin: 10
                height: visible ? 44 : 0
                radius: 10
                color: AppState.colors.primarySoft
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 8
                    Label {
                        text: "Scan your wallpapers to see Linux compatibility ratings"
                        color: AppState.colors.fg
                        Layout.fillWidth: true
                    }
                    Button { text: "Scan"; onClicked: { win.navIndex = 4; settingsPage.startScan() } }
                    Button { text: "Dismiss"; flat: true; onClicked: AppState.updateSetting("dismissedScanReminder", true) }
                }
            }

            Rectangle {
                visible: !AppState.daemonConnected
                Layout.fillWidth: true
                Layout.leftMargin: 12
                Layout.rightMargin: 12
                Layout.topMargin: 10
                height: visible ? 44 : 0
                radius: 10
                color: AppState.colors.destructive
                Label {
                    anchors.centerIn: parent
                    text: "Backend daemon unreachable — retrying… (run `bun run daemon`)"
                    color: AppState.dark ? "#1a0d12" : "#fff"
                    font.weight: Font.DemiBold
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
                height: 36
                color: AppState.colors.surface
                // top edge separator
                Rectangle {
                    anchors.top: parent.top
                    anchors.left: parent.left
                    anchors.right: parent.right
                    height: 1
                    color: AppState.colors.border
                }

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
}
