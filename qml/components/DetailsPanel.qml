import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."

// Right-hand details panel for a library wallpaper: metadata, apply/stop,
// compatibility tagging, engine overrides + project.json properties,
// debug logs, unsubscribe.
Rectangle {
    id: panel
    property var wallpaper: null
    signal closed()

    color: AppState.colors.surface
    // left edge separator instead of a full box border
    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 1
        color: AppState.colors.border
    }

    readonly property var backgroundId: wallpaper ? (wallpaper.path || wallpaper.id) : ""
    readonly property var activeScreens: backgroundId ? AppState.activeScreensFor(backgroundId) : []
    readonly property var engineFields: [
        { control: "select", key: "scaling", globalKey: "defaultScaling", label: "Scaling",
          options: [{label:"Default",value:"default"},{label:"Fill",value:"fill"},{label:"Fit",value:"fit"},{label:"Stretch",value:"stretch"}],
          fallback: "fill", globalValue: AppState.settings ? AppState.settings.defaultScaling : "fill" },
        { control: "slider", key: "volume", globalKey: "volume", label: "Volume", min: 0, max: 100, suffix: "%",
          fallback: 100, globalValue: AppState.settings ? AppState.settings.volume : 100 },
        { control: "switch", key: "audioProcessing", globalKey: "audioProcessing", label: "Audio reactive effects",
          fallback: true, globalValue: AppState.settings ? AppState.settings.audioProcessing : true },
        { control: "switch", key: "disableMouse", globalKey: "disableMouse", label: "Disable mouse interaction",
          fallback: false, globalValue: AppState.settings ? AppState.settings.disableMouse : false },
        { control: "switch", key: "disableParallax", globalKey: "disableParallax", label: "Disable parallax effect",
          fallback: false, globalValue: AppState.settings ? AppState.settings.disableParallax : false },
        { control: "switch", key: "disableParticles", globalKey: "disableParticles", label: "Disable particle effects",
          fallback: false, globalValue: AppState.settings ? AppState.settings.disableParticles : false }
    ]

    property var editOverrides: null
    property var editCustomValues: ({})
    property var propertyList: []
    property bool overridesDirty: false
    property bool applying: false
    property string errorMessage: ""
    property string debugScreen: ""

    function load() {
        editOverrides = null
        editCustomValues = {}
        propertyList = []
        overridesDirty = false
        errorMessage = ""
        if (!wallpaper || !wallpaper.path) return
        AppState.rpc("wallpaper.getOverrides", { path: wallpaper.path }, function(res) {
            res = res || {}
            editOverrides = res
            editCustomValues = res.customProperties || {}
            overridesDirty = false
        })
        AppState.rpc("wallpaper.listProperties", { path: wallpaper.path }, function(res) {
            propertyList = res || []
        })
    }

    onWallpaperChanged: load()
    Component.onCompleted: load()

    function apply(screen) {
        if (!backgroundId) return
        applying = true
        errorMessage = ""
        AppState.applyWallpaper(backgroundId, screen, function(res) {
            applying = false
            if (!res.success) {
                if (res.error && res.error.indexOf("not installed") >= 0) backendDialog.open()
                else errorMessage = "Wallpaper failed to apply. It may not be compatible."
            } else if (AppState.settings && AppState.settings.debugMode) {
                var primary = AppState.primaryDisplay()
                debugScreen = screen || (primary ? primary.name : "default")
                debugDialog.screen = debugScreen
                debugDialog.open()
            }
        })
    }

    function saveOverrides() {
        if (!wallpaper || !wallpaper.path) return
        var ov = Object.assign({}, editOverrides || {})
        ov.customProperties = Object.assign({}, editCustomValues)
        AppState.rpc("wallpaper.saveOverrides", { path: wallpaper.path, overrides: ov }, function() {
            overridesDirty = false
        })
    }

    function resetOverrides() {
        if (!wallpaper || !wallpaper.path) return
        AppState.rpc("wallpaper.resetOverrides", { path: wallpaper.path }, function() {
            load()
        })
    }

    DebugLogDialog { id: debugDialog; screen: panel.debugScreen }
    Dialog {
        id: backendDialog
        title: "Backend not installed"
        modal: true
        anchors.centerIn: parent
        standardButtons: Dialog.Ok
        Label {
            text: "linux-wallpaperengine is not installed or is not on PATH.\nInstall it to apply wallpapers."
            color: AppState.colors.fg
        }
    }

    Flickable {
        anchors.fill: parent
        contentHeight: col.implicitHeight + 24
        clip: true
        ColumnLayout {
            id: col
            width: parent.width - 24
            x: 12
            y: 12
            spacing: 10

            RowLayout {
                Layout.fillWidth: true
                Label {
                    text: panel.wallpaper ? (panel.wallpaper.title || "Wallpaper") : ""
                    font.bold: true
                    font.pixelSize: 16
                    color: AppState.colors.fg
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                }
                Button {
                    text: "✕"
                    flat: true
                    onClicked: panel.closed()
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 170
                radius: 10
                clip: true
                color: AppState.colors.secondary
                AnimatedImage {
                    anchors.fill: parent
                    source: panel.wallpaper ? AppState.fileUrl(panel.wallpaper.thumbnail || panel.wallpaper.previewUrl) : ""
                    fillMode: Image.PreserveAspectCrop
                    asynchronous: true
                    sourceSize: Qt.size(680, 340)
                }
            }

            // ── Metadata ─────────────────────────────────────────────
            GridLayout {
                columns: 2
                Layout.fillWidth: true
                columnSpacing: 12
                Label { text: "Author"; color: AppState.colors.mutedFg; font.pixelSize: 11 }
                Label { text: (panel.wallpaper && panel.wallpaper.author) || "—"; color: AppState.colors.fg; font.pixelSize: 11 }
                Label { text: "Type"; color: AppState.colors.mutedFg; font.pixelSize: 11 }
                Label { text: AppState.typeLabel(panel.wallpaper && panel.wallpaper.type); color: AppState.colors.fg; font.pixelSize: 11 }
                Label { text: "Resolution"; color: AppState.colors.mutedFg; font.pixelSize: 11 }
                Label {
                    text: panel.wallpaper && panel.wallpaper.resolution ? panel.wallpaper.resolution.width + "x" + panel.wallpaper.resolution.height : "—"
                    color: AppState.colors.fg; font.pixelSize: 11
                }
                Label { text: "Size"; color: AppState.colors.mutedFg; font.pixelSize: 11 }
                Label {
                    text: panel.wallpaper && panel.wallpaper.fileSize ? (panel.wallpaper.fileSize / 1048576).toFixed(1) + " MB" : "—"
                    color: AppState.colors.fg; font.pixelSize: 11
                }
            }

            // tags
            Flow {
                Layout.fillWidth: true
                spacing: 4
                Repeater {
                    model: (panel.wallpaper && panel.wallpaper.tags) || []
                    delegate: Rectangle {
                        height: 18; width: tagLbl.implicitWidth + 10; radius: 9
                        color: AppState.colors.secondary
                        Label { id: tagLbl; anchors.centerIn: parent; text: modelData; font.pixelSize: 10; color: AppState.colors.secondaryFg }
                    }
                }
            }

            // ── Actions ──────────────────────────────────────────────
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                ApplyButton {
                    Layout.fillWidth: true
                    backgroundId: panel.backgroundId
                    activeScreens: panel.activeScreens
                    busy: panel.applying
                    onApply: function(screen) { panel.apply(screen) }
                    onStop: function(screens) { AppState.stopWallpaper(screens) }
                }
                Button {
                    visible: !!(panel.wallpaper && panel.wallpaper.workshopId)
                    text: "Unsub"
                    onClicked: {
                        AppState.rpc("workshop.unsubscribe", { workshopId: panel.wallpaper.workshopId }, function(res) {
                            if (res === false) panel.errorMessage = "Steam is not connected. Start Steam and log in, then try again."
                            else AppState.refreshWallpapers()
                        }, function() { panel.errorMessage = "Steam is not connected. Start Steam and log in, then try again." })
                    }
                }
                Button {
                    visible: !!(panel.wallpaper && panel.wallpaper.workshopId)
                    text: "↗"
                    ToolTip.visible: hovered; ToolTip.text: "Open in browser"
                    onClicked: AppState.rpc("window.openExternal", { url: "https://steamcommunity.com/sharedfiles/filedetails/?id=" + panel.wallpaper.workshopId })
                }
            }

            Label {
                visible: panel.errorMessage.length > 0
                text: panel.errorMessage
                color: AppState.colors.destructive
                font.pixelSize: 11
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            Label {
                visible: panel.activeScreens.length > 0
                text: "Active on: " + panel.activeScreens.join(", ")
                color: AppState.colors.success
                font.pixelSize: 11
            }

            Rectangle { Layout.fillWidth: true; height: 1; color: AppState.colors.border }

            // ── Compatibility ────────────────────────────────────────
            RowLayout {
                Layout.fillWidth: true
                Label { text: "Compatibility"; font.bold: true; color: AppState.colors.fg; Layout.fillWidth: true }
                Rectangle {
                    width: 10; height: 10; radius: 5
                    color: AppState.compatColor(AppState.compatOf(panel.wallpaper))
                }
                ComboBox {
                    model: [
                        { label: "Unknown", value: "unknown" },
                        { label: "Perfect", value: "perfect" },
                        { label: "Minor Issues", value: "minor" },
                        { label: "Major Issues", value: "major" },
                        { label: "Broken", value: "broken" }
                    ]
                    textRole: "label"
                    Layout.preferredWidth: 130
                    Component.onCompleted: {
                        var s = AppState.compatOf(panel.wallpaper)
                        var i = model.findIndex(function(o){ return o.value === s })
                        if (i >= 0) currentIndex = i
                    }
                    onActivated: {
                        if (panel.wallpaper && panel.wallpaper.path) {
                            AppState.rpc("wallpaper.setCompatibility",
                                { path: panel.wallpaper.path, status: model[currentIndex].value },
                                function() { AppState.refreshCompatibility() })
                        }
                    }
                }
            }

            Rectangle { Layout.fillWidth: true; height: 1; color: AppState.colors.border }

            // ── Per-wallpaper settings ───────────────────────────────
            RowLayout {
                Layout.fillWidth: true
                Label { text: "Wallpaper settings"; font.bold: true; color: AppState.colors.fg; Layout.fillWidth: true }
                Button {
                    text: "Save"
                    enabled: panel.overridesDirty
                    highlighted: panel.overridesDirty
                    onClicked: panel.saveOverrides()
                }
                Button {
                    text: "Reset"
                    flat: true
                    onClicked: panel.resetOverrides()
                }
            }

            OverridesEditor {
                Layout.fillWidth: true
                fields: panel.engineFields
                overrides: panel.editOverrides
                properties: panel.propertyList
                customValues: panel.editCustomValues
                onChanged: function(o, c) {
                    panel.editOverrides = o
                    panel.editCustomValues = c
                    panel.overridesDirty = true
                }
            }

            Button {
                visible: AppState.settings && !!AppState.settings.debugMode
                text: "View debug logs"
                flat: true
                onClicked: {
                    var primary = AppState.primaryDisplay()
                    panel.debugScreen = (panel.activeScreens[0]) || (primary ? primary.name : "default")
                    debugDialog.screen = panel.debugScreen
                    debugDialog.open()
                }
            }
        }
    }
}
