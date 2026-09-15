import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import ".."
import "../components"

// Create / edit a playlist: name, ordered wallpaper selection, timing
// settings, and per-playlist engine overrides.
Item {
    id: editor
    property string editName: ""   // "" -> create new
    signal done()

    property string name: ""
    property var items: []
    property int delay: 1
    property string timeunit: "seconds"
    property string order: "sequential"
    property bool updateonpause: false
    property bool videosequence: false
    property var overrides: null
    property string search: ""
    property string errorMessage: ""

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

    function load() {
        if (!editName) return
        AppState.rpc("playlist.get", { name: editName }, function(res) {
            if (!res) return
            editor.name = res.name
            editor.items = res.items || []
            var s = res.settings || {}
            editor.delay = s.delay || 1
            editor.timeunit = s.timeunit || "seconds"
            editor.order = s.order || "sequential"
            editor.updateonpause = !!s.updateonpause
            editor.videosequence = !!s.videosequence
            editor.overrides = s.overrides || null
        })
    }
    Component.onCompleted: load()

    function toggleItem(path) {
        var arr = items.slice()
        var i = arr.indexOf(path)
        if (i >= 0) arr.splice(i, 1)
        else arr.push(path)
        items = arr
    }

    function pickerModel() {
        var q = search.trim().toLowerCase()
        var out = []
        for (var i = 0; i < AppState.wallpapers.length; i++) {
            var w = AppState.wallpapers[i]
            if (q && (w.title || "").toLowerCase().indexOf(q) < 0) continue
            out.push(w)
        }
        return out
    }

    function save() {
        if (!name.trim()) { errorMessage = "Playlist needs a name"; return }
        if (items.length === 0) { errorMessage = "Select at least one wallpaper"; return }
        errorMessage = ""
        var payload = {
            name: name.trim(),
            items: items,
            settings: {
                delay: delay,
                timeunit: timeunit,
                mode: "timer",
                order: order,
                updateonpause: updateonpause,
                videosequence: videosequence,
                overrides: overrides || undefined
            }
        }
        if (editName) {
            AppState.rpc("playlist.update", { name: editName, playlist: payload }, function(res) {
                if (res && res.error) errorMessage = res.error
                else done()
            }, function(e) { errorMessage = e.message })
        } else {
            AppState.rpc("playlist.create", payload, function(res) {
                if (res && res.error) errorMessage = res.error
                else done()
            }, function(e) { errorMessage = e.message })
        }
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 20

        // Left: wallpaper picker
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 10

            RowLayout {
                Layout.fillWidth: true
                Button { text: "Back"; icon.source: "../icons/arrow-left.svg"; flat: true; onClicked: editor.done() }
                Label {
                    text: editor.editName ? "Edit Playlist" : "New Playlist"
                    font.bold: true; font.pixelSize: 18; color: AppState.colors.fg
                }
                Item { Layout.fillWidth: true }
            }

            TextField {
                Layout.fillWidth: true
                Layout.maximumWidth: 320
                placeholderText: "Search wallpapers…"
                Material.containerStyle: Material.Filled
                onTextChanged: editor.search = text
            }

            // Selected chips (ordered)
            Flow {
                Layout.fillWidth: true
                spacing: 4
                visible: editor.items.length > 0
                Repeater {
                    model: editor.items
                    delegate: Rectangle {
                        height: 22; width: chipLbl.implicitWidth + 28; radius: 11
                        color: AppState.colors.primarySoft
                        Label {
                            id: chipLbl
                            anchors.centerIn: parent
                            text: {
                                var items2 = AppState.wallpapers
                                for (var i = 0; i < items2.length; i++)
                                    if (items2[i].path === modelData) return (index + 1) + ". " + items2[i].title
                                return (index + 1) + ". " + String(modelData).split("/").pop()
                            }
                            font.pixelSize: 10
                            color: AppState.colors.primary
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: editor.toggleItem(modelData)
                            ToolTip.visible: containsMouse
                            ToolTip.text: "Remove"
                        }
                    }
                }
            }

            GridView {
                id: pickerGrid
                Layout.fillWidth: true
                Layout.fillHeight: true
                cellWidth: Math.floor(width / Math.max(1, Math.floor(width / 180)))
                cellHeight: cellWidth * 0.72
                model: editor.pickerModel()
                clip: true
                reuseItems: true
                cacheBuffer: cellHeight * 4
                ScrollBar.vertical: ScrollBar {}
                delegate: WallpaperCard {
                    width: pickerGrid.cellWidth - 12
                    height: pickerGrid.cellHeight - 12
                    wallpaper: modelData
                    selected: editor.items.indexOf(modelData.path) >= 0
                    onClicked: editor.toggleItem(modelData.path)
                    Rectangle {
                        visible: editor.items.indexOf(modelData.path) >= 0
                        anchors.bottom: parent.bottom
                        anchors.right: parent.right
                        anchors.margins: 6
                        width: 22; height: 22; radius: 11
                        color: AppState.colors.primary
                        Label {
                            anchors.centerIn: parent
                            text: String(editor.items.indexOf(modelData.path) + 1)
                            color: AppState.colors.primaryFg
                            font.bold: true
                            font.pixelSize: 11
                        }
                    }
                }
            }
        }

        // Right: settings
        Flickable {
            Layout.preferredWidth: 340
            Layout.fillHeight: true
            contentHeight: settingsCol.implicitHeight
            clip: true
            ColumnLayout {
                id: settingsCol
                width: parent.width
                spacing: 12

                Label { text: "Name"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                TextField {
                    Layout.fillWidth: true
                    text: editor.name
                    placeholderText: "My playlist"
                    enabled: !editor.editName
                    onTextChanged: editor.name = text
                }

                Label { text: "Rotate every"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                RowLayout {
                    SpinBox {
                        from: 1; to: 9999
                        value: editor.delay
                        onValueModified: editor.delay = value
                    }
                    ComboBox {
                        model: [{label:"sec",value:"seconds"},{label:"min",value:"minutes"},{label:"hr",value:"hours"}]
                        textRole: "label"
                        currentIndex: editor.timeunit === "minutes" ? 1 : editor.timeunit === "hours" ? 2 : 0
                        onActivated: editor.timeunit = model[currentIndex].value
                    }
                }

                Label { text: "Order"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                ComboBox {
                    Layout.fillWidth: true
                    model: [{label:"Sequential",value:"sequential"},{label:"Random",value:"random"}]
                    textRole: "label"
                    currentIndex: editor.order === "random" ? 1 : 0
                    onActivated: editor.order = model[currentIndex].value
                }

                CheckBox {
                    text: "Update on pause"
                    checked: editor.updateonpause
                    onClicked: editor.updateonpause = checked
                }
                CheckBox {
                    text: "Video sequence"
                    checked: editor.videosequence
                    onClicked: editor.videosequence = checked
                }

                Rectangle { Layout.fillWidth: true; height: 1; color: AppState.colors.border }

                Label { text: "Engine overrides"; font.bold: true; color: AppState.colors.fg }
                Label { text: "Unchecked rows inherit global settings"; color: AppState.colors.mutedFg; font.pixelSize: 11 }

                OverridesEditor {
                    Layout.fillWidth: true
                    fields: editor.engineFields
                    overrides: editor.overrides
                    properties: []
                    customValues: ({})
                    onChanged: function(o, c) { editor.overrides = o }
                }

                Label {
                    visible: editor.errorMessage.length > 0
                    text: editor.errorMessage
                    color: AppState.colors.destructive
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                Button {
                    Layout.fillWidth: true
                    text: editor.editName ? "Save Playlist" : "Create Playlist"
                    highlighted: true
                    onClicked: editor.save()
                }
            }
        }
    }
}
