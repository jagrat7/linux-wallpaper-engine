import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."

// Apply button with per-display dropdown, mirroring the React ApplyButton:
// - main click applies to all displays (or primary in window mode)
// - menu offers per-screen apply, and stop entries for screens where active
Button {
    id: btn
    property var backgroundId: ""
    property var activeScreens: []
    property bool busy: false
    signal apply(var screen)
    signal stop(var screens)

    text: busy ? "Applying…" : (activeScreens.length ? "Applied" : "Apply")
    highlighted: true
    enabled: !busy && !!backgroundId
    onClicked: btn.apply(undefined)

    Menu {
        id: menu
        y: btn.height
        MenuItem {
            text: "Apply to all displays"
            onTriggered: btn.apply(undefined)
        }
        MenuSeparator {}
        Repeater {
            model: AppState.displays
            delegate: MenuItem {
                text: "Apply to " + modelData.name
                onTriggered: btn.apply(modelData.name)
            }
        }
        MenuSeparator { visible: btn.activeScreens.length > 0 }
        MenuItem {
            visible: btn.activeScreens.length > 0
            text: "Stop all"
            onTriggered: btn.stop(btn.activeScreens)
        }
        Repeater {
            model: btn.activeScreens
            delegate: MenuItem {
                text: "Stop on " + modelData
                onTriggered: btn.stop(modelData)
            }
        }
    }

    // Small arrow button to open the menu
    MouseArea {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 22
        cursorShape: Qt.PointingHandCursor
        onClicked: menu.open()
        Label {
            anchors.centerIn: parent
            text: "▾"
            color: AppState.colors.fg
        }
    }
}
