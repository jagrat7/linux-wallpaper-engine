import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import ".."
import "../components"

Item {
    id: page

    property string mode: "discover"          // discover | browse
    property string search: ""
    property string connectionError: ""
    property bool loading: false

    // browse state
    property var browseItems: []
    property int browsePage: 1
    property bool browseHasNext: false
    property int browseTotal: 0

    // discover state: [{id,title,items,page,hasNextPage}]
    property var sections: []

    // details
    property var selected: null
    property var selectedStatus: null
    property bool applying: false
    property bool subscribing: false
    property string detailError: ""

    function wsSort() { return (AppState.settings && AppState.settings.workshopSortBy) || "trend" }

    function load() {
        if (showBrowse()) loadBrowse()
        else loadDiscover()
    }

    function showBrowse() { return mode === "browse" || search.trim().length > 0 }

    function loadDiscover() {
        loading = true
        connectionError = ""
        AppState.rpc("workshop.discover", { sortBy: wsSort() }, function(res) {
            loading = false
            sections = (res && res.sections) || []
        }, function(err) {
            loading = false
            if (err.code === "PRECONDITION_FAILED") connectionError = err.message
            else connectionError = err.message || "Failed to load workshop"
        })
    }

    function loadMoreSection(section) {
        var nextPage = (section.page || 1) + 1
        AppState.rpc("workshop.discover", { sortBy: wsSort(), focusedSectionId: section.id, page: nextPage }, function(res) {
            var updated = (res && res.sections) || []
            if (!updated.length) return
            var fresh = updated[0]
            var copy = sections.slice()
            for (var i = 0; i < copy.length; i++) {
                if (copy[i].id === section.id) {
                    var merged = Object.assign({}, fresh)
                    merged.items = copy[i].items.concat(fresh.items)
                    copy[i] = merged
                }
            }
            sections = copy
        })
    }

    function loadBrowse(pageNum) {
        var p = pageNum || browsePage
        loading = true
        connectionError = ""
        AppState.rpc("workshop.getItems", {
            search: search.trim() || undefined,
            cursor: AppState.workshopCursor(p),
            sortBy: wsSort()
        }, function(res) {
            loading = false
            browseItems = (res && res.items) || []
            browseHasNext = !!(res && res.hasNextPage)
            browseTotal = (res && res.totalResults) || 0
            browsePage = p
        }, function(err) {
            loading = false
            connectionError = err.message || "Failed to load workshop"
        })
    }

    function select(item) {
        selected = item
        detailError = ""
        refreshSelectedStatus()
    }

    function refreshSelectedStatus() {
        if (!selected) return
        AppState.rpc("workshop.status", { workshopId: selected.id }, function(res) {
            selectedStatus = res
        }, function() { selectedStatus = null })
    }

    function subscribe() {
        if (!selected) return
        subscribing = true
        AppState.rpc("workshop.subscribe", { workshopId: selected.id }, function() {
            subscribing = false
            refreshSelectedStatus()
        }, function(e) { subscribing = false; detailError = e.message })
    }

    function unsubscribe() {
        if (!selected) return
        subscribing = true
        AppState.rpc("workshop.unsubscribe", { workshopId: selected.id }, function() {
            subscribing = false
            selectedStatus = null
        }, function(e) { subscribing = false; detailError = e.message })
    }

    function applySelected(screen) {
        if (!selectedStatus || !selectedStatus.path) return
        applying = true
        AppState.applyWallpaper(selectedStatus.path, screen, function(res) {
            applying = false
            if (!res.success) detailError = "Wallpaper failed to apply."
        })
    }

    function toggleFavoriteSection(id) {
        var s = AppState.settings || {}
        var cur = (s.favoriteDiscoverSectionIds || []).slice()
        var i = cur.indexOf(id)
        if (i >= 0) cur.splice(i, 1)
        else cur.push(id)
        AppState.updateSetting("favoriteDiscoverSectionIds", cur)
    }

    function filterSections() {
        var s = AppState.settings || {}
        return [
            { key: "workshopFilterType", title: "Type",
              items: [{key:"scene",label:"Scene"},{key:"video",label:"Video"},{key:"web",label:"Web"},{key:"application",label:"Application"}],
              selected: s.workshopFilterType || [] },
            { key: "workshopFilterAgeRating", title: "Age rating",
              items: [{key:"g",label:"G"},{key:"pg13",label:"PG13"},{key:"r",label:"R"}],
              selected: s.workshopFilterAgeRating || [] },
            { key: "workshopFilterTags", title: "Tags",
              items: workshopTags().map(function(t){ return {key:t,label:t} }),
              selected: s.workshopFilterTags || [] },
            { key: "workshopFilterResolution", title: "Resolution",
              items: [{key:"1920x1080",label:"1920x1080"},{key:"2560x1440",label:"2560x1440"},{key:"3840x2160",label:"3840x2160"},{key:"1366x768",label:"1366x768"}],
              selected: s.workshopFilterResolution || [] }
        ]
    }

    function workshopTags() {
        var seen = {}, out = []
        var pools = [browseItems]
        for (var s = 0; s < sections.length; s++) pools.push(sections[s].items)
        for (var p = 0; p < pools.length; p++)
            for (var i = 0; i < pools[p].length; i++)
                for (var t of (pools[p][i].tags || [])) if (!seen[t]) { seen[t] = true; out.push(t) }
        return out.sort()
    }

    Connections {
        target: AppState
        function onWorkshopConnectionEvent(data) {
            page.refreshSelectedStatus()
            if (page.connectionError) page.load()
        }
    }

    Component.onCompleted: load()
    onVisibleChanged: if (visible && browseItems.length === 0 && sections.length === 0 && !loading) load()

    // Debounce search
    Timer {
        id: searchDebounce
        interval: 400
        onTriggered: page.loadBrowse(1)
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
                Label { text: "Workshop"; font.bold: true; font.pixelSize: 20; color: AppState.colors.fg }
                Label { text: "Browse wallpapers from Steam Workshop"; color: AppState.colors.mutedFg; font.pixelSize: 12 }
                Item { Layout.fillWidth: true }
                Button { text: "Refresh"; enabled: !page.loading; onClicked: page.load() }
            }

            // Toolbar
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                RowLayout {
                    spacing: 0
                    ButtonGroup { id: modeGroup }
                    Button {
                        text: "Discover"
                        checkable: true
                        checked: !page.showBrowse()
                        highlighted: checked
                        ButtonGroup.group: modeGroup
                        onClicked: { page.mode = "discover"; page.search = ""; searchField.text = ""; page.loadDiscover() }
                    }
                    Button {
                        text: "Browse"
                        checkable: true
                        checked: page.showBrowse()
                        highlighted: checked
                        ButtonGroup.group: modeGroup
                        onClicked: { page.mode = "browse"; page.loadBrowse(1) }
                    }
                }
                TextField {
                    id: searchField
                    Layout.fillWidth: true
                    Layout.maximumWidth: 320
                    placeholderText: "Search workshop…"
                    Material.containerStyle: Material.Filled
                    onTextChanged: { page.search = text; searchDebounce.restart() }
                    Keys.onEscapePressed: { text = ""; page.search = ""; searchDebounce.stop(); page.load(); focus = false }
                }
                ComboBox {
                    model: [{label:"Trending",value:"trend"},{label:"Most Popular",value:"votes"},{label:"Most Subscribed",value:"subscriptions"},{label:"Newest",value:"date"},{label:"Recently Updated",value:"updated"}]
                    textRole: "label"
                    Layout.preferredWidth: 150
                    Component.onCompleted: {
                        var i = model.findIndex(function(o){ return o.value === page.wsSort() })
                        if (i >= 0) currentIndex = i
                    }
                    onActivated: { AppState.updateSetting("workshopSortBy", model[currentIndex].value, function(){ page.load() }) }
                }
                Button {
                    text: "Filters"
                    onClicked: { filterPopup.sections = page.filterSections(); filterPopup.open() }
                }
                Item { Layout.fillWidth: true }
            }

            // Connection error / prompt
            Rectangle {
                visible: page.connectionError.length > 0
                Layout.fillWidth: true
                height: 60
                radius: 8
                color: AppState.colors.card
                border.color: AppState.colors.destructive
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    Label {
                        Layout.fillWidth: true
                        text: "Steam connection required\n" + page.connectionError
                        color: AppState.colors.fg
                        font.pixelSize: 12
                    }
                    Button { text: "Retry"; onClicked: page.load() }
                }
            }

            BusyIndicator { visible: page.loading; Layout.alignment: Qt.AlignHCenter }

            // ── Discover view ────────────────────────────────────────
            Flickable {
                visible: !page.showBrowse() && !page.loading
                Layout.fillWidth: true
                Layout.fillHeight: true
                contentHeight: discoverCol.implicitHeight
                clip: true
                ScrollBar.vertical: ScrollBar {}
                ColumnLayout {
                    id: discoverCol
                    width: parent.width
                    spacing: 18
                    Repeater {
                        model: page.sections
                        delegate: ColumnLayout {
                            property var section: modelData
                            Layout.fillWidth: true
                            spacing: 6
                            RowLayout {
                                Layout.fillWidth: true
                                Label { text: section.title; font.bold: true; font.pixelSize: 14; color: AppState.colors.fg }
                                Button {
                                    text: (AppState.settings && (AppState.settings.favoriteDiscoverSectionIds || []).indexOf(section.id) >= 0) ? "★" : "☆"
                                    flat: true
                                    ToolTip.visible: hovered; ToolTip.text: "Favorite section"
                                    onClicked: page.toggleFavoriteSection(section.id)
                                }
                                Item { Layout.fillWidth: true }
                                Button {
                                    text: "More"
                                    flat: true
                                    visible: !!section.hasNextPage
                                    onClicked: page.loadMoreSection(section)
                                }
                            }
                            GridView {
                                Layout.fillWidth: true
                                Layout.preferredHeight: Math.ceil(section.items.length / Math.max(1, Math.floor(width / 180))) * 150
                                cellWidth: Math.floor(width / Math.max(1, Math.floor(width / 180)))
                                cellHeight: 150
                                model: section.items
                                interactive: false
                                delegate: WallpaperCard {
                                    width: GridView.view.cellWidth - 12
                                    height: GridView.view.cellHeight - 12
                                    workshop: true
                                    wallpaper: modelData
                                    selected: page.selected && page.selected.id === modelData.id
                                    onClicked: page.select(modelData)
                                }
                            }
                        }
                    }
                    Label {
                        visible: page.sections.length === 0 && !page.loading && page.connectionError.length === 0
                        text: "Nothing to show"
                        color: AppState.colors.mutedFg
                    }
                }
            }

            // ── Browse view ──────────────────────────────────────────
            ColumnLayout {
                visible: page.showBrowse()
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 8
                GridView {
                    id: browseGrid
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    cellWidth: Math.floor(width / Math.max(1, Math.floor(width / 180)))
                    cellHeight: cellWidth * 0.72
                    model: page.browseItems
                    clip: true
                    reuseItems: true
                    cacheBuffer: cellHeight * 4
                    ScrollBar.vertical: ScrollBar {}
                    delegate: WallpaperCard {
                        width: browseGrid.cellWidth - 12
                        height: browseGrid.cellHeight - 12
                        workshop: true
                        wallpaper: modelData
                        selected: page.selected && page.selected.id === modelData.id
                        onClicked: page.select(modelData)
                    }
                }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Button { text: "← Prev"; enabled: page.browsePage > 1 && !page.loading; onClicked: page.loadBrowse(page.browsePage - 1) }
                    Label { text: "Page " + page.browsePage + (page.browseTotal ? " · " + page.browseTotal + " results" : ""); color: AppState.colors.mutedFg }
                    Button { text: "Next →"; enabled: page.browseHasNext && !page.loading; onClicked: page.loadBrowse(page.browsePage + 1) }
                }
            }
        }

        // ── Details panel ────────────────────────────────────────────
        Rectangle {
            visible: page.selected !== null
            Layout.preferredWidth: 340
            Layout.fillHeight: true
            color: AppState.colors.surface
            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 1
                color: AppState.colors.border
            }
            Flickable {
                anchors.fill: parent
                contentHeight: detailCol.implicitHeight + 24
                clip: true
                ColumnLayout {
                    id: detailCol
                    width: parent.width - 24
                    x: 12; y: 12
                    spacing: 10
                    RowLayout {
                        Layout.fillWidth: true
                        Label {
                            text: page.selected ? page.selected.title : ""
                            font.bold: true; font.pixelSize: 16; color: AppState.colors.fg
                            wrapMode: Text.WordWrap; Layout.fillWidth: true
                        }
                        Button { text: "✕"; flat: true; onClicked: page.selected = null }
                    }
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 170
                        radius: 10
                        clip: true
                        color: AppState.colors.secondary
                        AnimatedImage {
                            anchors.fill: parent
                            source: page.selected ? AppState.fileUrl(page.selected.previewUrl || page.selected.thumbnail) : ""
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                            sourceSize: Qt.size(680, 340)
                        }
                    }
                    Label { text: "by " + (page.selected ? (page.selected.author || "Unknown") : ""); color: AppState.colors.mutedFg; font.pixelSize: 11 }
                    Flow {
                        Layout.fillWidth: true; spacing: 4
                        Repeater {
                            model: (page.selected && page.selected.tags) || []
                            delegate: Rectangle {
                                height: 18; width: tLbl.implicitWidth + 10; radius: 9
                                color: AppState.colors.secondary
                                Label { id: tLbl; anchors.centerIn: parent; text: modelData; font.pixelSize: 10; color: AppState.colors.secondaryFg }
                            }
                        }
                    }

                    // status
                    Label {
                        visible: page.selectedStatus && page.selectedStatus.download
                        text: page.selectedStatus && page.selectedStatus.download
                              ? "Downloading… " + Math.round(100 * page.selectedStatus.download.current / Math.max(1, page.selectedStatus.download.total)) + "%"
                              : ""
                        color: AppState.colors.primary
                    }
                    ProgressBar {
                        visible: page.selectedStatus && !!page.selectedStatus.download
                        Layout.fillWidth: true
                        value: page.selectedStatus && page.selectedStatus.download ? page.selectedStatus.download.current / Math.max(1, page.selectedStatus.download.total) : 0
                    }
                    Label {
                        visible: page.selectedStatus && page.selectedStatus.path
                        text: "Installed"
                        color: AppState.colors.success
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        Button {
                            Layout.fillWidth: true
                            text: page.subscribing ? "Working…" : (page.selectedStatus && page.selectedStatus.path ? "Unsubscribe" : "Subscribe")
                            enabled: !page.subscribing
                            onClicked: (page.selectedStatus && page.selectedStatus.path) ? page.unsubscribe() : page.subscribe()
                        }
                        Button {
                            text: "↗"
                            ToolTip.visible: hovered; ToolTip.text: "Open in browser"
                            onClicked: AppState.rpc("window.openExternal", { url: "https://steamcommunity.com/sharedfiles/filedetails/?id=" + page.selected.id })
                        }
                    }
                    ApplyButton {
                        Layout.fillWidth: true
                        visible: page.selectedStatus && !!page.selectedStatus.path
                        backgroundId: page.selectedStatus ? page.selectedStatus.path : ""
                        activeScreens: page.selectedStatus && page.selectedStatus.path ? AppState.activeScreensFor(page.selectedStatus.path) : []
                        busy: page.applying
                        onApply: function(screen) { page.applySelected(screen) }
                        onStop: function(screens) { AppState.stopWallpaper(screens) }
                    }
                    Label {
                        visible: page.detailError.length > 0
                        text: page.detailError
                        color: AppState.colors.destructive
                        font.pixelSize: 11
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                }
            }
        }
    }

    FilterPopup {
        id: filterPopup
        onToggled: function(sectionKey, itemKey, on) {
            var s = AppState.settings || {}
            var cur = (s[sectionKey] || []).slice()
            var i = cur.indexOf(itemKey)
            if (on && i < 0) cur.push(itemKey)
            if (!on && i >= 0) cur.splice(i, 1)
            var patch = {}
            patch[sectionKey] = cur
            AppState.updateSettings(patch, function() { page.load() })
        }
        onCleared: {
            AppState.updateSettings({
                workshopFilterType: [], workshopFilterAgeRating: [],
                workshopFilterTags: [], workshopFilterResolution: []
            }, function() { page.load() })
        }
    }
}
