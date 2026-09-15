import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."

Dialog {
    id: dlg
    property string screen: ""
    property string command: ""
    property var logs: []

    title: "Debug Logs — " + screen
    modal: true
    width: 640
    height: 480
    anchors.centerIn: parent
    standardButtons: Dialog.Close

    function refresh() {
        AppState.rpc("wallpaper.getDebugLogs", { screen: dlg.screen }, function(res) {
            dlg.command = res.command || ""
            dlg.logs = res.logs || []
        })
    }

    onOpened: refresh()

    ColumnLayout {
        anchors.fill: parent
        spacing: 8
        Label {
            text: dlg.command ? "$ " + dlg.command : "No command captured"
            color: AppState.colors.mutedFg
            font.pixelSize: 11
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: AppState.dark ? "#00000055" : "#00000010"
            radius: 6
            border.color: AppState.colors.border
            Flickable {
                anchors.fill: parent
                anchors.margins: 8
                contentWidth: logText.contentWidth
                contentHeight: logText.contentHeight
                clip: true
                flickableDirection: Flickable.HorizontalAndVerticalFlick
                TextEdit {
                    id: logText
                    text: dlg.logs.length ? dlg.logs.join("\n") : "(no logs captured yet)"
                    color: AppState.colors.fg
                    font.family: "monospace"
                    font.pixelSize: 11
                    readOnly: true
                    selectByMouse: true
                    width: Math.max(contentWidth, parent.width)
                }
            }
        }
        RowLayout {
            Layout.fillWidth: true
            Button {
                text: "Refresh"
                onClicked: dlg.refresh()
            }
            Button {
                text: "Clear logs"
                onClicked: AppState.rpc("wallpaper.clearDebugLogs", { screen: dlg.screen }, function() { dlg.refresh() })
            }
            Item { Layout.fillWidth: true }
        }
    }
}
