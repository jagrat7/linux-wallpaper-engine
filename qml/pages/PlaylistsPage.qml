import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import ".."
import "../components"

Item {
    id: page

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: listComponent

        Component {
            id: listComponent
            Item {
                id: listRoot
                property string search: ""

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 24
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        Label { text: "Playlists"; font.bold: true; font.pixelSize: 20; color: AppState.colors.fg }
                        Label { text: "Create wallpaper rotations with custom timing"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                        Item { Layout.fillWidth: true }
                        Button {
                            text: "+ New Playlist"
                            highlighted: true
                            onClicked: stack.push(editorComponent, { editName: "" })
                        }
                    }

                    TextField {
                        visible: AppState.playlists.length > 0
                        Layout.preferredWidth: 280
                        placeholderText: "Search playlists…"
                        Material.containerStyle: Material.Filled
                        onTextChanged: listRoot.search = text
                    }

                    Flickable {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        contentHeight: listCol.implicitHeight
                        clip: true
                        ColumnLayout {
                            id: listCol
                            width: parent.width
                            spacing: 10

                            Repeater {
                                model: {
                                    var items = AppState.playlists.slice()
                                    var q = listRoot.search.trim().toLowerCase()
                                    if (q) items = items.filter(function(p){ return p.name.toLowerCase().indexOf(q) >= 0 })
                                    items.sort(function(a, b){ return (b.updatedAt || 0) - (a.updatedAt || 0) })
                                    return items
                                }
                                delegate: PlaylistRow {
                                    Layout.fillWidth: true
                                    playlist: modelData
                                    onEditRequested: stack.push(editorComponent, { editName: modelData.name })
                                }
                            }

                            Label {
                                visible: AppState.playlists.length === 0
                                text: "No playlists yet\nCreate a playlist to rotate wallpapers automatically"
                                color: AppState.colors.mutedFg
                                horizontalAlignment: Text.AlignHCenter
                                Layout.alignment: Qt.AlignHCenter
                                Layout.topMargin: 60
                            }
                        }
                    }
                }
            }
        }
    }

    Component {
        id: editorComponent
        PlaylistEditor {
            onDone: {
                AppState.refreshPlaylists()
                stack.pop()
            }
        }
    }

    component PlaylistRow: Rectangle {
        id: row
        property var playlist: null
        signal editRequested()

        implicitHeight: rowCol.implicitHeight + 20
        radius: 10
        color: AppState.colors.card
        border.color: AppState.colors.border

        readonly property var activeScreens: playlist ? AppState.playlistScreensFor(playlist.name) : []
        property bool applying: false

        function start(screen) {
            row.applying = true
            var input = { playlistName: row.playlist.name }
            if (screen) input.screen = screen
            AppState.rpc("playlist.start", input, function(res) {
                row.applying = false
                AppState.refreshPlaylistsActive()
                AppState.refreshActive()
                if (res && res.success === false && res.error && res.error.indexOf("not installed") >= 0)
                    backendDialog.open()
            })
        }

        ColumnLayout {
            id: rowCol
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 2
                    Label {
                        text: row.playlist ? row.playlist.name : ""
                        font.bold: true
                        font.pixelSize: 15
                        color: AppState.colors.fg
                    }
                    Label {
                        text: {
                            if (!row.playlist) return ""
                            var s = row.playlist.settings || {}
                            var unit = s.timeunit === "minutes" ? "min" : s.timeunit === "hours" ? "hr" : "sec"
                            return (row.playlist.items ? row.playlist.items.length : 0) + " wallpapers · every "
                                 + (s.delay || 1) + " " + unit + " · " + (s.order || "sequential")
                        }
                        color: AppState.colors.mutedFg
                        font.pixelSize: 11
                    }
                    Label {
                        visible: row.activeScreens.length > 0
                        text: "Active on: " + row.activeScreens.join(", ")
                        color: AppState.colors.success
                        font.pixelSize: 11
                    }
                }

                Row {
                    spacing: 4
                    Repeater {
                        model: (row.playlist ? row.playlist.items : []).slice(0, 4)
                        delegate: Rectangle {
                            width: 44; height: 30
                            radius: 5
                            clip: true
                            color: AppState.colors.secondary
                            AnimatedImage {
                                anchors.fill: parent
                                source: {
                                    var items = AppState.wallpapers
                                    for (var i = 0; i < items.length; i++) {
                                        if (items[i].path === modelData || items[i].id === modelData)
                                            return AppState.fileUrl(items[i].thumbnail)
                                    }
                                    return ""
                                }
                                fillMode: Image.PreserveAspectCrop
                                asynchronous: true
                                sourceSize: Qt.size(88, 60)
                            }
                            CornerMask {
                                anchors.fill: parent
                                radius: 5
                                maskColor: AppState.colors.card
                            }
                        }
                    }
                }

                Button {
                    text: row.applying ? "Applying…" : "Apply"
                    highlighted: true
                    enabled: !row.applying
                    onClicked: applyMenu.open()
                    Menu {
                        id: applyMenu
                        MenuItem { text: "Apply to all displays"; onTriggered: row.start(undefined) }
                        MenuSeparator {}
                        Repeater {
                            model: AppState.displays
                            delegate: MenuItem {
                                text: "Apply to " + modelData.name
                                onTriggered: row.start(modelData.name)
                            }
                        }
                    }
                }
                Button {
                    text: "Stop"
                    visible: row.activeScreens.length > 0
                    onClicked: AppState.rpc("playlist.stop", { playlistName: row.playlist.name }, function() {
                        AppState.refreshPlaylistsActive(); AppState.refreshActive()
                    })
                }
                Button { text: "Edit"; onClicked: row.editRequested() }
                Button { text: "Delete"; onClicked: deleteDialog.open() }
            }
        }

        Dialog {
            id: deleteDialog
            title: "Delete playlist"
            modal: true
            anchors.centerIn: Overlay.overlay
            standardButtons: Dialog.Yes | Dialog.No
            Label { text: "Delete \"" + (row.playlist ? row.playlist.name : "") + "\"?"; color: AppState.colors.fg }
            onAccepted: AppState.rpc("playlist.delete", { name: row.playlist.name }, function() { AppState.refreshPlaylists() })
        }
        Dialog {
            id: backendDialog
            title: "Backend not installed"
            modal: true
            anchors.centerIn: Overlay.overlay
            standardButtons: Dialog.Ok
            Label { text: "linux-wallpaperengine is not installed or is not on PATH."; color: AppState.colors.fg }
        }
    }
}
