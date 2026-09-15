import QtQuick
import QtQuick.Controls

// Tinted icon display. Uses ToolButton's icon pipeline, which honors
// icon.color for recoloring monochrome SVGs (unlike bare Image).
// Non-interactive: no hover highlight, no focus, no ripple.
ToolButton {
    id: root
    property url src: ""
    property color tint: "white"
    property int size: 16

    icon.source: root.src
    icon.color: root.tint
    icon.width: root.size
    icon.height: root.size
    display: AbstractButton.IconOnly
    flat: true
    hoverEnabled: false
    focusPolicy: Qt.NoFocus
    padding: 0
    implicitWidth: root.size
    implicitHeight: root.size
    background: Item {}
}
