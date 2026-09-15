// Screenshot harness: instantiates the real app window, waits, grabs, exits.
// Usage: qml6 qml/grab.qml /tmp/shot.png [navIndex] [delayMs] [action]
// action: "select" selects the first wallpaper (opens details panel)
import QtQuick
import QtQuick.Window
import "."

Item {
    property var win: null
    property int nav: Qt.application.arguments.length > 3 ? parseInt(Qt.application.arguments[3]) : -1
    property int wait: Qt.application.arguments.length > 4 ? parseInt(Qt.application.arguments[4]) : 4000
    property string act: Qt.application.arguments.length > 5 ? Qt.application.arguments[5] : ""
    property string out: Qt.application.arguments.length > 2 ? Qt.application.arguments[2] : "/tmp/shot.png"

    Component.onCompleted: {
        var c = Qt.createComponent("main.qml")
        if (c.status === Component.Error) {
            console.log("ERR: " + c.errorString())
            Qt.exit(1)
        }
        win = c.createObject(null)
        if (!win) { console.log("ERR: createObject failed"); Qt.exit(1) }
        if (nav >= 0) win.navIndex = nav
        grabTimer.start()
    }

    Timer {
        id: grabTimer
        interval: wait
        onTriggered: {
            if (act === "select" && AppState.wallpapers.length > 0)
                AppState.selectedWallpaper = AppState.wallpapers[0]
            var item = null
            for (var i = 0; i < win.contentItem.children.length; i++) {
                var c = win.contentItem.children[i]
                if (c.width > 0 && c.grabToImage) { item = c; break }
            }
            if (!item) { console.log("ERR: no grab item"); Qt.exit(1) }
            item.grabToImage(function(result) {
                result.saveToFile(out)
                console.log("saved " + out)
                Qt.quit()
            })
        }
    }
}
