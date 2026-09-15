import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import Qt.labs.platform as Labs
import "."
import "components"
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
        { label: "Library", icon: "icons/download.svg" },
        { label: "Workshop", icon: "icons/steam.svg" },
        { label: "Playlists", icon: "icons/list-video.svg" },
        { label: "Displays", icon: "icons/monitor.svg" },
        { label: "Settings", icon: "icons/settings.svg" }
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

    function goToSettings() { win.navIndex = 4 }

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

        // ── Sidebar: icon rail, same as the React app ────────────────
        Rectangle {
            Layout.fillHeight: true
            width: 60
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
                anchors.topMargin: 10
                anchors.bottomMargin: 10
                spacing: 6

                // app logo
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 44
                    Image {
                        anchors.centerIn: parent
                        width: 30; height: 30
                        source: "../assets/transparent-logo.png"
                        fillMode: Image.PreserveAspectFit
                    }
                }
                Rectangle {
                    Layout.fillWidth: true
                    Layout.leftMargin: 8
                    Layout.rightMargin: 8
                    Layout.bottomMargin: 4
                    height: 1
                    color: AppState.colors.border
                }

                Repeater {
                    model: win.navModel
                    delegate: ToolButton {
                        id: navBtn
                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: 42
                        Layout.preferredHeight: 42
                        readonly property bool active: win.navIndex === index
                        icon.source: modelData.icon
                        icon.width: 19
                        icon.height: 19
                        icon.color: active ? AppState.colors.primary : AppState.colors.mutedFg
                        flat: true
                        checkable: true
                        checked: active
                        autoExclusive: false
                        ToolTip.text: modelData.label
                        ToolTip.visible: hovered
                        ToolTip.delay: 400
                        onClicked: win.navIndex = index
                        background: Rectangle {
                            radius: 10
                            color: navBtn.active ? AppState.colors.primarySoft
                               : (navBtn.hovered ? AppState.colors.card : "transparent")
                            Behavior on color { ColorAnimation { duration: 100 } }
                        }
                    }
                }
                Item { Layout.fillHeight: true }

                // daemon status
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 8; height: 8; radius: 4
                    color: AppState.daemonConnected ? AppState.colors.success : AppState.colors.destructive
                    ToolTip.visible: statusHover.hovered
                    ToolTip.text: AppState.daemonConnected ? "Daemon connected" : "Daemon offline"
                    HoverHandler { id: statusHover }
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
                WorkshopPage { id: workshopPage }
                PlaylistsPage {}
                DisplaysPage {}
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
                    spacing: 10
                    Icon {
                        src: "icons/monitor.svg"
                        tint: AppState.colors.mutedFg
                        size: 14
                    }
                    Label {
                        text: parent.parent.primary ? parent.parent.primary.name : "No display"
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
                            if (p) return p.name
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
                    ToolButton {
                        icon.source: AppState.settings && AppState.settings.silent ? "icons/volume-x.svg" : "icons/volume-2.svg"
                        icon.color: AppState.colors.mutedFg
                        icon.width: 16; icon.height: 16
                        flat: true
                        ToolTip.text: AppState.settings && AppState.settings.silent ? "Unmute" : "Mute"
                        ToolTip.visible: hovered
                        onClicked: AppState.updateSetting("silent", !(AppState.settings && AppState.settings.silent))
                    }
                    ToolButton {
                        icon.source: "icons/square.svg"
                        icon.color: enabled ? AppState.colors.mutedFg : AppState.colors.border
                        icon.width: 14; icon.height: 14
                        flat: true
                        ToolTip.text: "Stop wallpaper"
                        ToolTip.visible: hovered
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
