import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ".."
import "../components"

Item {
    id: page

    function filterSections() {
        var s = AppState.settings || {}
        return [
            { key: "filterType", title: "Type",
              items: [{key:"scene",label:"Scene"},{key:"video",label:"Video"},{key:"web",label:"Web"},{key:"application",label:"Application"}],
              selected: s.filterType || [] },
            { key: "filterAgeRating", title: "Age rating",
              items: [{key:"g",label:"G"},{key:"pg13",label:"PG13"},{key:"r",label:"R"}],
              selected: s.filterAgeRating || [] },
            { key: "filterCompatibility", title: "Compatibility",
              items: [{key:"perfect",label:"Perfect"},{key:"minor",label:"Minor"},{key:"major",label:"Major"},{key:"broken",label:"Broken"},{key:"unknown",label:"Unknown"}],
              selected: s.filterCompatibility || [] },
            { key: "filterTags", title: "Tags",
              items: AppState.availableTags().map(function(t){ return {key: t, label: t} }),
              selected: s.filterTags || [] },
            { key: "filterResolution", title: "Resolution",
              items: AppState.availableResolutions().map(function(r){ return {key: r, label: r} }),
              selected: s.filterResolution || [] }
        ]
    }

    function toggleFilter(key, item, on) {
        var s = AppState.settings || {}
        var cur = (s[key] || []).slice()
        var i = cur.indexOf(item)
        if (on && i < 0) cur.push(item)
        if (!on && i >= 0) cur.splice(i, 1)
        var patch = {}
        patch[key] = cur
        AppState.updateSettings(patch)
    }

    function activeFilterCount() {
        var s = AppState.settings || {}
        return (s.filterType||[]).length + (s.filterAgeRating||[]).length + (s.filterTags||[]).length
             + (s.filterResolution||[]).length + (s.filterCompatibility||[]).length
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 16

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 12

            RowLayout {
                Layout.fillWidth: true
                Label { text: "Library"; font.bold: true; font.pixelSize: 20; color: AppState.colors.fg }
                Label { text: "Manage your wallpapers"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                Item { Layout.fillWidth: true }
                Button {
                    text: grid.refreshing ? "Refreshing…" : "Refresh"
                    enabled: !grid.refreshing
                    onClicked: {
                        grid.refreshing = true
                        AppState.rpc("wallpaper.invalidateCache", undefined, function() {
                            AppState.refreshWallpapers()
                            grid.refreshing = false
                        })
                    }
                }
            }

            // Toolbar
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                TextField {
                    id: searchField
                    Layout.fillWidth: true
                    Layout.maximumWidth: 380
                    placeholderText: "Search wallpapers… (Ctrl+K)"
                    text: AppState.librarySearch
                    onTextChanged: searchDebounce.restart()
                    Keys.onEscapePressed: { text = ""; AppState.librarySearch = ""; focus = false }

                    Timer {
                        id: searchDebounce
                        interval: 250
                        onTriggered: AppState.librarySearch = searchField.text
                    }
                    Label {
                        visible: searchField.text.length > 0
                        anchors.right: parent.right
                        anchors.rightMargin: 6
                        anchors.verticalCenter: parent.verticalCenter
                        text: "✕"
                        color: AppState.colors.mutedFg
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: { searchField.text = ""; AppState.librarySearch = "" }
                        }
                    }
                    Shortcut {
                        sequence: "Ctrl+K"
                        onActivated: searchField.forceActiveFocus()
                    }
                    Shortcut {
                        sequence: "Ctrl+F"
                        onActivated: searchField.forceActiveFocus()
                    }
                }
                Label {
                    text: {
                        var total = AppState.wallpapers.length
                        if (!total) return ""
                        var shown = grid.count
                        return shown === total ? total + " wallpapers" : shown + " / " + total
                    }
                    color: AppState.colors.mutedFg
                    font.pixelSize: 11
                }
                Button {
                    text: "Filters" + (page.activeFilterCount() ? " (" + page.activeFilterCount() + ")" : "")
                    onClicked: {
                        filterPopup.sections = page.filterSections()
                        filterPopup.open()
                    }
                }
                ComboBox {
                    id: sortBox
                    model: [{label:"Name",value:"name"},{label:"Date Added",value:"date"},{label:"Size",value:"size"},{label:"Recent",value:"recent"}]
                    textRole: "label"
                    Layout.preferredWidth: 140
                    Component.onCompleted: {
                        var v = AppState.settings ? AppState.settings.sortBy : "date"
                        var i = model.findIndex(function(o){ return o.value === v })
                        if (i >= 0) currentIndex = i
                    }
                    onActivated: AppState.updateSetting("sortBy", model[currentIndex].value)
                }
                Button {
                    text: (AppState.settings && AppState.settings.sortOrder === "asc") ? "↑ Asc" : "↓ Desc"
                    onClicked: AppState.updateSetting("sortOrder", (AppState.settings && AppState.settings.sortOrder === "asc") ? "desc" : "asc")
                }
                Item { Layout.fillWidth: true }
            }

            // Grid
            Item {
                id: gridWrap
                Layout.fillWidth: true
                Layout.fillHeight: true

                readonly property int cardMin: {
                    var d = AppState.settings ? AppState.settings.wallpaperGridDensity : "medium"
                    return d === "compact" ? 160 : d === "large" ? 320 : 200
                }

                GridView {
                    id: grid
                    anchors.fill: parent
                    property bool refreshing: false
                    cellWidth: Math.floor(width / Math.max(1, Math.floor(width / (gridWrap.cardMin + 16))))
                    cellHeight: cellWidth * 0.75
                    model: AppState.filteredWallpapers()
                    clip: true
                    reuseItems: true
                    cacheBuffer: cellHeight * 4
                    ScrollBar.vertical: ScrollBar {}

                    delegate: WallpaperCard {
                        width: grid.cellWidth - 16
                        height: grid.cellHeight - 16
                        wallpaper: modelData
                        selected: AppState.selectedWallpaper === modelData
                        activeScreens: AppState.activeScreensFor(modelData.path || modelData.id).length
                        onClicked: {
                            AppState.selectedWallpaper = (AppState.selectedWallpaper === modelData) ? null : modelData
                        }
                    }
                }

                BusyIndicator {
                    anchors.centerIn: parent
                    visible: !AppState.wallpapersLoaded
                }

                Label {
                    anchors.centerIn: parent
                    visible: AppState.wallpapersLoaded && grid.count === 0
                    text: AppState.wallpapers.length === 0
                          ? "No wallpapers found.\nInstall wallpapers via Steam Workshop, then refresh."
                          : "No wallpapers match your filters."
                    color: AppState.colors.mutedFg
                    horizontalAlignment: Text.AlignHCenter
                }

                // Scroll-to-top, mirrors the React grid's floating button
                RoundButton {
                    visible: grid.contentY > 300
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    anchors.margins: 16
                    text: "↑"
                    onClicked: grid.positionViewAtBeginning()
                }
            }
        }

        // Details panel
        DetailsPanel {
            visible: AppState.selectedWallpaper !== null
            Layout.preferredWidth: 340
            Layout.fillHeight: true
            wallpaper: AppState.selectedWallpaper
            onClosed: AppState.selectedWallpaper = null
        }
    }

    FilterPopup {
        id: filterPopup
        onToggled: function(sectionKey, itemKey, on) { page.toggleFilter(sectionKey, itemKey, on) }
        onCleared: {
            AppState.updateSettings({
                filterType: [], filterAgeRating: [], filterTags: [],
                filterResolution: [], filterCompatibility: []
            })
        }
    }
}
