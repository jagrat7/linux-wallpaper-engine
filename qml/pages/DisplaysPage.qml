import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."
import "../components"

Item {
    id: page

    function activeFor(screen) {
        for (var i = 0; i < AppState.activeWallpapers.length; i++) {
            if (AppState.activeWallpapers[i].screen === screen) return AppState.activeWallpapers[i]
        }
        return null
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 16

        RowLayout {
            Layout.fillWidth: true
            Label { text: "Displays"; font.bold: true; font.pixelSize: 20; color: AppState.colors.fg }
            Label { text: "View wallpapers for each monitor"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
            Item { Layout.fillWidth: true }
            Rectangle {
                height: 20; width: badgeLbl.implicitWidth + 16; radius: 4
                color: AppState.colors.secondary
                visible: AppState.sessionType.length > 0
                Label {
                    id: badgeLbl
                    anchors.centerIn: parent
                    text: AppState.sessionType.toUpperCase()
                    color: AppState.colors.mutedFg
                    font.pixelSize: 10
                }
            }
        }

        // Monitor layout visualization
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 260
            radius: 12
            color: AppState.colors.card
            border.color: AppState.colors.border

            Label {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.margins: 16
                text: "Monitor Layout"
                font.pixelSize: 12
                color: AppState.colors.mutedFg
            }

            Row {
                anchors.centerIn: parent
                spacing: 16
                visible: AppState.displays.length > 0
                Repeater {
                    model: AppState.displays
                    delegate: Rectangle {
                        width: 180; height: 110
                        radius: 8
                        color: AppState.colors.secondary
                        border.color: AppState.colors.border
                        clip: true
                        property var active: page.activeFor(modelData.name)
                        AnimatedImage {
                            anchors.fill: parent
                            source: active && active.thumbnail ? AppState.fileUrl(active.thumbnail) : ""
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                            sourceSize: Qt.size(360, 220)
                            visible: status === AnimatedImage.Ready
                        }
                        Label {
                            visible: !parent.active
                            anchors.centerIn: parent
                            text: "+"
                            font.pixelSize: 24
                            color: AppState.colors.mutedFg
                        }
                        Rectangle {
                            anchors.left: parent.left
                            anchors.top: parent.top
                            anchors.margins: 6
                            height: 16; width: nameLbl.implicitWidth + 10; radius: 4
                            color: "#000000aa"
                            Label {
                                id: nameLbl
                                anchors.centerIn: parent
                                text: modelData.name
                                color: "#fff"
                                font.pixelSize: 10
                            }
                        }
                    }
                }
            }
            Label {
                anchors.centerIn: parent
                visible: AppState.displays.length === 0
                text: "No displays detected"
                color: AppState.colors.mutedFg
            }
        }

        Label { text: "Display Settings"; font.bold: true; font.pixelSize: 15; color: AppState.colors.fg }

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
                    model: AppState.displays
                    delegate: Rectangle {
                        Layout.fillWidth: true
                        height: 64
                        radius: 8
                        color: AppState.colors.card
                        border.color: AppState.colors.border
                        property var active: page.activeFor(modelData.name)
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 12
                            Rectangle {
                                width: 36; height: 36; radius: 6
                                color: AppState.colors.secondary
                                Label { anchors.centerIn: parent; text: "🖥"; font.pixelSize: 16 }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                Label { text: modelData.name; font.weight: Font.DemiBold; color: AppState.colors.fg }
                                Label { text: modelData.id + " — " + modelData.resolution + (modelData.primary ? " (primary)" : ""); color: AppState.colors.mutedFg; font.pixelSize: 11 }
                            }
                            ColumnLayout {
                                spacing: 2
                                Label {
                                    text: parent.parent.active ? parent.parent.active.title : "No wallpaper"
                                    color: AppState.colors.fg
                                    font.pixelSize: 12
                                    horizontalAlignment: Text.AlignRight
                                }
                                Label {
                                    text: "Scaling: " + (parent.parent.active && parent.parent.active.wallpaper.scaling ? parent.parent.active.wallpaper.scaling : "default")
                                    color: AppState.colors.mutedFg
                                    font.pixelSize: 10
                                    horizontalAlignment: Text.AlignRight
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
