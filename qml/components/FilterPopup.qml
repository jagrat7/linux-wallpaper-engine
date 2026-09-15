import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."

// Multi-section checkbox filter popup.
// sections: [{ key, title, items: [{key,label}], selected: [keys] }]
// The parent replaces `sections` wholesale on every toggle, which rebuilds
// the delegates and their bindings.
Popup {
    id: popup
    property var sections: []
    signal toggled(string sectionKey, string itemKey, bool isChecked)
    signal cleared()

    width: 300
    padding: 12
    background: Rectangle {
        color: AppState.colors.card
        border.color: AppState.colors.border
        radius: 10
    }

    contentItem: Flickable {
        implicitHeight: Math.min(col.implicitHeight, 420)
        contentHeight: col.implicitHeight
        clip: true
        ColumnLayout {
            id: col
            width: parent.width
            spacing: 10
            Repeater {
                model: popup.sections
                delegate: ColumnLayout {
                    id: sectionDelegate
                    property var section: modelData
                    Layout.fillWidth: true
                    spacing: 4
                    Label {
                        text: sectionDelegate.section.title
                        font.bold: true
                        font.pixelSize: 12
                        color: AppState.colors.mutedFg
                    }
                    Repeater {
                        model: sectionDelegate.section.items
                        delegate: CheckBox {
                            property string secKey: sectionDelegate.section.key
                            text: modelData.label
                            checked: (sectionDelegate.section.selected || []).indexOf(modelData.key) >= 0
                            onClicked: popup.toggled(secKey, modelData.key, checked)
                        }
                    }
                }
            }
            Button {
                text: "Clear all filters"
                flat: true
                Layout.alignment: Qt.AlignHCenter
                onClicked: popup.cleared()
            }
        }
    }
}
