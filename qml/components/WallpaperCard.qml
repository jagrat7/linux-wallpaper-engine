import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window
import ".."

Item {
    id: card
    property var wallpaper: null
    property bool selected: false
    property bool workshop: false
    property int activeScreens: 0
    signal clicked()

    // card body
    Rectangle {
        anchors.fill: parent
        radius: 12
        color: AppState.colors.card
    }

    // everything inside the rounded edge — masked to the corner radius
    Item {
        id: content
        anchors.fill: parent

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
            scale: cardHover.hovered ? 1.05 : 1.0
            Behavior on scale { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
        }
        Label {
            anchors.centerIn: parent
            visible: thumbImage.status !== AnimatedImage.Ready
            text: "…"
            color: AppState.colors.mutedFg
        }

        // Title sits on a gradient scrim over the image
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: Math.min(parent.height * 0.45, 52)
            gradient: Gradient {
                GradientStop { position: 0.0; color: "transparent" }
                GradientStop { position: 1.0; color: "#d9000000" }
            }
            Label {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.margins: 8
                text: card.wallpaper ? (card.wallpaper.title || card.wallpaper.id) : ""
                color: "#ffffff"
                font.pixelSize: 12
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }
        }
    }

    // mask the square corners of the content to the card radius
    CornerMask {
        anchors.fill: parent
        radius: 12
        maskColor: AppState.colors.bg
    }

    // rounded border drawn on top of the mask
    Rectangle {
        anchors.fill: parent
        radius: 12
        color: "transparent"
        border.color: card.selected ? AppState.colors.primary
                                  : (cardHover.hovered ? AppState.colors.primary : AppState.colors.border)
        border.width: card.selected ? 2 : 1
    }

    HoverHandler { id: cardHover }

    // compatibility dot
    Rectangle {
        visible: !card.workshop && AppState.settings && !!AppState.settings.showCompatibilityDot
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: 8
        width: 12; height: 12; radius: 6
        color: AppState.compatColor(card.wallpaper ? AppState.compatOf(card.wallpaper) : "unknown")
        border.color: "#66000000"
        border.width: 1
        ToolTip.visible: compatHover.hovered
        ToolTip.text: AppState.compatLabel(card.wallpaper ? AppState.compatOf(card.wallpaper) : "unknown")
        HoverHandler { id: compatHover }
    }

    // top-left chip stack: type + active
    Column {
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.margins: 8
        spacing: 6

        Rectangle {
            height: 18
            width: typeLabel.implicitWidth + 12
            radius: 9
            color: AppState.colors.chip
            visible: !!(card.wallpaper && card.wallpaper.type)
            Label {
                id: typeLabel
                anchors.centerIn: parent
                text: AppState.typeLabel(card.wallpaper ? card.wallpaper.type : "")
                color: "#fff"
                font.pixelSize: 10
            }
        }
        Rectangle {
            visible: card.activeScreens > 0
            height: 18; width: activeLabel.implicitWidth + 12; radius: 9
            color: AppState.colors.success
            Label {
                id: activeLabel
                anchors.centerIn: parent
                text: "Active"
                color: "#0d1119"
                font.pixelSize: 10
                font.bold: true
            }
        }
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: card.clicked()
    }
}
