import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window
import ".."

Rectangle {
    id: card
    property var wallpaper: null
    property bool selected: false
    property bool workshop: false
    property int activeScreens: 0
    signal clicked()

    radius: 10
    color: AppState.colors.card
    border.color: selected ? AppState.colors.primary
                         : (cardHover.hovered ? AppState.colors.primary : AppState.colors.border)
    border.width: selected ? 2 : 1
    clip: true

    HoverHandler { id: cardHover }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 100

            AnimatedImage {
                id: thumbImage
                anchors.fill: parent
                source: {
                    var w = card.wallpaper
                    if (!w) return ""
                    var src = w.thumbnail || w.previewUrl || ""
                    return AppState.fileUrl(src)
                }
                fillMode: Image.PreserveAspectCrop
                asynchronous: true
                cache: true
                // Decode at display size instead of full preview resolution —
                // big memory/CPU win for large animated previews.
                sourceSize: Qt.size(Math.max(1, Math.round(width * Screen.devicePixelRatio)),
                                    Math.max(1, Math.round(height * Screen.devicePixelRatio)))
                visible: status === AnimatedImage.Ready
            }
            Rectangle {
                anchors.fill: parent
                color: AppState.colors.secondary
                visible: thumbImage.status !== AnimatedImage.Ready
                Label {
                    anchors.centerIn: parent
                    text: "…"
                    color: AppState.colors.mutedFg
                }
            }

            // compatibility dot
            Rectangle {
                visible: !card.workshop && AppState.settings && !!AppState.settings.showCompatibilityDot
                anchors.top: parent.top
                anchors.right: parent.right
                anchors.margins: 6
                width: 12; height: 12; radius: 6
                color: AppState.compatColor(card.wallpaper ? AppState.compatOf(card.wallpaper) : "unknown")
                border.color: "#00000044"
                ToolTip.visible: compatHover.containsMouse
                ToolTip.text: AppState.compatLabel(card.wallpaper ? AppState.compatOf(card.wallpaper) : "unknown")
                HoverHandler { id: compatHover }
            }

            // active badge — wallpaper is currently applied to N screens
            Rectangle {
                visible: card.activeScreens > 0
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.margins: 6
                height: 18; width: activeLabel.implicitWidth + 12; radius: 9
                color: AppState.colors.success
                Label {
                    id: activeLabel
                    anchors.centerIn: parent
                    text: "Active"
                    color: "#000"
                    font.pixelSize: 10
                    font.bold: true
                }
            }

            // type badge
            Rectangle {
                anchors.left: parent.left
                anchors.bottom: parent.bottom
                anchors.margins: 6
                height: 18
                width: typeLabel.implicitWidth + 12
                radius: 9
                color: "#000000aa"
                visible: !!(card.wallpaper && card.wallpaper.type)
                Label {
                    id: typeLabel
                    anchors.centerIn: parent
                    text: AppState.typeLabel(card.wallpaper ? card.wallpaper.type : "")
                    color: "#fff"
                    font.pixelSize: 10
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            height: 34
            color: "transparent"
            Label {
                anchors.fill: parent
                anchors.leftMargin: 8
                anchors.rightMargin: 8
                text: card.wallpaper ? (card.wallpaper.title || card.wallpaper.id) : ""
                color: AppState.colors.fg
                font.pixelSize: 12
                elide: Text.ElideRight
                verticalAlignment: Text.AlignVCenter
            }
        }
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: card.clicked()
    }
}
