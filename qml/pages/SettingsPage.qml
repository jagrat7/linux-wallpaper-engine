import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."
import "../components"

Item {
    id: page

    function s() { return AppState.settings || {} }

    function update(key, value) { AppState.updateSetting(key, value) }

    function fpsOptions() {
        var base = [30, 60, 90, 120, 144, 165, 240, 360]
        var set = {}
        for (var i = 0; i < base.length; i++) if (base[i] <= AppState.maxRefreshRate) set[base[i]] = true
        if (AppState.maxRefreshRate > 0) set[AppState.maxRefreshRate] = true
        if (s().fps > 0) set[s().fps] = true
        return Object.keys(set).map(Number).sort(function(a, b){ return a - b })
    }

    function startScan() {
        scanConfirm.open()
    }

    // ── section wrapper ────────────────────────────────────────────────
    component Section: ColumnLayout {
        property string title: ""
        property string desc: ""
        default property alias content: inner.data
        Layout.fillWidth: true
        spacing: 0
        Label { text: title; font.bold: true; font.pixelSize: 14; color: AppState.colors.fg }
        Label { text: desc; font.pixelSize: 11; color: AppState.colors.mutedFg; visible: desc.length > 0 }
        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 6
            radius: 10
            color: AppState.colors.card
            border.color: AppState.colors.border
            implicitHeight: inner.implicitHeight + 20
            ColumnLayout {
                id: inner
                anchors.fill: parent
                anchors.margins: 10
                spacing: 4
            }
        }
    }

    component SettingRow: RowLayout {
        property string label: ""
        default property alias content: ctrl.data
        Layout.fillWidth: true
        spacing: 8
        Label { text: label; color: AppState.colors.fg; Layout.fillWidth: true; wrapMode: Text.WordWrap }
        RowLayout { id: ctrl; spacing: 8 }
    }

    Flickable {
        anchors.fill: parent
        contentHeight: col.implicitHeight + 48
        clip: true

        ColumnLayout {
            id: col
            width: parent.width - 48
            x: 24; y: 24
            spacing: 20

            RowLayout {
                Layout.fillWidth: true
                ColumnLayout {
                    Label { text: "Settings"; font.bold: true; font.pixelSize: 20; color: AppState.colors.fg }
                    Label { text: "Configure global application preferences"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                }
                Item { Layout.fillWidth: true }
                Button {
                    text: "Reset to Defaults"
                    onClicked: resetDialog.open()
                }
            }

            // ── General ──────────────────────────────────────────────
            Section {
                title: "General"
                desc: "App behavior and startup"
                SettingRow {
                    label: "Pause on fullscreen apps"
                    Switch { checked: !!s().pauseOnFullscreen; onClicked: page.update("pauseOnFullscreen", checked) }
                }
                SettingRow {
                    label: "Launch on startup"
                    Switch { checked: !!s().launchOnLogin; onClicked: page.update("launchOnLogin", checked) }
                }
                SettingRow {
                    label: "Enable system tray"
                    Switch { checked: !!s().enableSystemTray; onClicked: page.update("enableSystemTray", checked) }
                }
                SettingRow {
                    label: "Minimize on startup"
                    Switch {
                        enabled: !!s().launchOnLogin && !!s().enableSystemTray
                        checked: !!s().minimizeOnStartup
                        onClicked: page.update("minimizeOnStartup", checked)
                    }
                }
                SettingRow {
                    label: "Minimize on close"
                    Switch {
                        enabled: !!s().enableSystemTray
                        checked: !!s().minimizeOnClose
                        onClicked: page.update("minimizeOnClose", checked)
                    }
                }
            }

            // ── Compatibility ────────────────────────────────────────
            Section {
                title: "Compatibility"
                desc: "Test wallpapers for Linux compatibility"
                SettingRow {
                    label: {
                        var p = AppState.scanProgress
                        if (p && p.running) return "Scanning… " + p.scanned + "/" + p.total
                        return "Compatibility scan"
                    }
                    RowLayout {
                        spacing: 8
                        ProgressBar {
                            visible: AppState.scanProgress && AppState.scanProgress.running
                            Layout.preferredWidth: 140
                            value: AppState.scanProgress && AppState.scanProgress.total ? AppState.scanProgress.scanned / AppState.scanProgress.total : 0
                        }
                        Button {
                            text: (AppState.scanProgress && AppState.scanProgress.running) ? "Abort" : "Scan"
                            onClicked: {
                                if (AppState.scanProgress && AppState.scanProgress.running)
                                    AppState.rpc("wallpaper.abortScan", undefined, function(){ AppState.refreshScanProgress() })
                                else page.startScan()
                            }
                        }
                        Button {
                            text: "Report"
                            enabled: AppState.scanReport.length > 0
                            onClicked: reportDialog.open()
                        }
                    }
                }
                SettingRow {
                    label: "Show compatibility dot"
                    Switch { checked: !!s().showCompatibilityDot; onClicked: page.update("showCompatibilityDot", checked) }
                }
                SettingRow {
                    label: "Debug mode"
                    Switch { checked: !!s().debugMode; onClicked: page.update("debugMode", checked) }
                }
                SettingRow {
                    label: "Run in window mode"
                    Switch { checked: !!s().windowMode; onClicked: page.update("windowMode", checked) }
                }
                SettingRow {
                    label: "Window size (WxH)"
                    visible: !!s().windowMode
                    RowLayout {
                        TextField {
                            id: geomField
                            text: s().windowGeometry || ""
                            placeholderText: "1920x1080"
                            Layout.preferredWidth: 120
                            property bool valid: text.length === 0 || /^[1-9]\d*x[1-9]\d*$/.test(text)
                        }
                        Button {
                            icon.source: "../icons/check.svg"
                            enabled: geomField.valid
                            onClicked: page.update("windowGeometry", geomField.text.length ? geomField.text : null)
                        }
                    }
                }
                SettingRow {
                    label: "Bypass Flatpak sandbox"
                    visible: AppState.isFlatpak
                    Switch { checked: !!s().flatpakBypass; onClicked: page.update("flatpakBypass", checked) }
                }
            }

            // ── Audio ────────────────────────────────────────────────
            Section {
                title: "Audio"
                desc: "Volume and audio processing"
                SettingRow {
                    label: "Volume"
                    RowLayout {
                        Slider {
                            from: 0; to: 100; stepSize: 1
                            value: s().volume !== undefined ? s().volume : 100
                            onMoved: page.update("volume", Math.round(value))
                            Layout.preferredWidth: 160
                        }
                        Label { text: Math.round(s().volume !== undefined ? s().volume : 100) + "%"; color: AppState.colors.mutedFg }
                    }
                }
                SettingRow {
                    label: "Mute audio"
                    Switch { checked: !!s().silent; onClicked: page.update("silent", checked) }
                }
                SettingRow {
                    label: "Don't mute when other apps play audio"
                    Switch { checked: !!s().noAutomute; onClicked: page.update("noAutomute", checked) }
                }
                SettingRow {
                    label: "Audio reactive effects"
                    Switch { checked: !!s().audioProcessing; onClicked: page.update("audioProcessing", checked) }
                }
            }

            // ── Display ──────────────────────────────────────────────
            Section {
                title: "Display"
                desc: "Default display behavior"
                SettingRow {
                    label: "Maximum FPS"
                    ComboBox {
                        model: page.fpsOptions()
                        Layout.preferredWidth: 120
                        Component.onCompleted: {
                            var i = model.indexOf(s().fps || 60)
                            if (i >= 0) currentIndex = i
                        }
                        onActivated: page.update("fps", model[currentIndex])
                        displayText: currentIndex >= 0 ? model[currentIndex] + " FPS" : ""
                    }
                }
                SettingRow {
                    label: "Default scaling"
                    ComboBox {
                        model: [{label:"Default",value:"default"},{label:"Fill",value:"fill"},{label:"Fit",value:"fit"},{label:"Stretch",value:"stretch"}]
                        textRole: "label"
                        Layout.preferredWidth: 120
                        Component.onCompleted: {
                            var i = model.findIndex(function(o){ return o.value === (s().defaultScaling || "fill") })
                            if (i >= 0) currentIndex = i
                        }
                        onActivated: page.update("defaultScaling", model[currentIndex].value)
                    }
                }
                SettingRow {
                    label: "Disable mouse interaction"
                    Switch { checked: !!s().disableMouse; onClicked: page.update("disableMouse", checked) }
                }
                SettingRow {
                    label: "Disable parallax effect"
                    Switch { checked: !!s().disableParallax; onClicked: page.update("disableParallax", checked) }
                }
                SettingRow {
                    label: "Disable particle effects"
                    Switch { checked: !!s().disableParticles; onClicked: page.update("disableParticles", checked) }
                }
            }

            // ── Appearance ───────────────────────────────────────────
            Section {
                title: "Appearance"
                desc: "Theme and visual preferences"
                SettingRow {
                    label: "Theme"
                    ComboBox {
                        model: [{label:"Light",value:"light"},{label:"Dark",value:"dark"},{label:"Steam",value:"steam"},{label:"System",value:"system"},{label:"Hard Light",value:"hard-light"}]
                        textRole: "label"
                        Layout.preferredWidth: 130
                        Component.onCompleted: {
                            var i = model.findIndex(function(o){ return o.value === (s().theme || "system") })
                            if (i >= 0) currentIndex = i
                        }
                        onActivated: page.update("theme", model[currentIndex].value)
                    }
                }
                SettingRow {
                    label: "Grid size"
                    RowLayout {
                        spacing: 0
                        Repeater {
                            model: [{label:"Compact",value:"compact"},{label:"Medium",value:"medium"},{label:"Large",value:"large"}]
                            delegate: Button {
                                text: modelData.label
                                checkable: true
                                checked: (s().wallpaperGridDensity || "medium") === modelData.value
                                onClicked: page.update("wallpaperGridDensity", modelData.value)
                            }
                        }
                    }
                }
                SettingRow {
                    label: "Show status bar"
                    Switch { checked: !!s().showStatusBar; onClicked: page.update("showStatusBar", checked) }
                }
                SettingRow {
                    label: "Dynamic background"
                    Switch { checked: !!s().dynamicBackground; onClicked: page.update("dynamicBackground", checked) }
                }
            }
        }
    }

    // ── Dialogs ────────────────────────────────────────────────────────
    Dialog {
        id: resetDialog
        title: "Reset settings"
        modal: true
        anchors.centerIn: Overlay.overlay
        standardButtons: Dialog.Yes | Dialog.No
        Label { text: "Reset all settings to defaults?\nActive wallpapers will be reapplied."; color: AppState.colors.fg }
        onAccepted: AppState.rpc("settings.reset", undefined, function(res) { AppState.settings = res })
    }

    Dialog {
        id: scanConfirm
        title: "Compatibility scan"
        modal: true
        anchors.centerIn: Overlay.overlay
        standardButtons: Dialog.Yes | Dialog.No
        Label {
            text: "Scan all wallpapers for Linux compatibility?\nEach wallpaper is briefly launched to test it."
            color: AppState.colors.fg
        }
        onAccepted: AppState.rpc("wallpaper.scanAll", undefined, function() {
            AppState.refreshScanProgress()
            AppState.refreshScanReport()
        })
    }

    Dialog {
        id: reportDialog
        title: "Compatibility report"
        modal: true
        width: 560
        height: 460
        anchors.centerIn: Overlay.overlay
        standardButtons: Dialog.Close

        function grouped() {
            var order = ["broken", "major", "minor", "perfect", "unknown"]
            var out = []
            var report = AppState.scanReport || []
            for (var o = 0; o < order.length; o++) {
                var status = order[o]
                var items = report.filter(function(r){ return r.status === status })
                if (items.length) out.push({ status: status, items: items })
            }
            return out
        }

        Flickable {
            anchors.fill: parent
            contentHeight: repCol.implicitHeight
            clip: true
            ColumnLayout {
                id: repCol
                width: parent.width
                spacing: 10
                Repeater {
                    model: reportDialog.grouped()
                    delegate: ColumnLayout {
                        property var group: modelData
                        Layout.fillWidth: true
                        spacing: 4
                        RowLayout {
                            Rectangle { width: 10; height: 10; radius: 5; color: AppState.compatColor(group.status) }
                            Label { text: AppState.compatLabel(group.status) + " (" + group.items.length + ")"; font.bold: true; color: AppState.colors.fg }
                        }
                        Repeater {
                            model: group.items
                            delegate: Label {
                                text: "  " + modelData.title
                                color: AppState.colors.mutedFg
                                font.pixelSize: 11
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }
                    }
                }
                Label {
                    visible: AppState.scanReport.length === 0
                    text: "No scan results yet"
                    color: AppState.colors.mutedFg
                }
            }
        }
    }
}
