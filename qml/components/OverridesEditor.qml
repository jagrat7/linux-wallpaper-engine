import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import ".."

// Edits per-wallpaper / per-playlist engine flag overrides plus
// project.json custom properties. Unset keys inherit global settings.
//
// fields: [{key, control, label, options?, min?, max?, suffix?, fallback, globalValue}]
// overrides: object|undefined  (edited copy owned by the parent)
// properties: project.json property list (for per-wallpaper editing)
// customValues: record name -> serialized value
// Emits changed(newOverrides, newCustomValues) on every user edit.
ColumnLayout {
    id: editor
    property var fields: []
    property var overrides: null
    property var properties: []
    property var customValues: ({})
    signal changed(var newOverrides, var newCustomValues)

    function setOverride(key, value) {
        var o = overrides ? Object.assign({}, overrides) : {}
        o[key] = value
        editor.changed(o, customValues)
    }

    function clearOverride(key) {
        var o = Object.assign({}, overrides || {})
        delete o[key]
        editor.changed(o, customValues)
    }

    function setCustom(name, value) {
        var c = Object.assign({}, customValues)
        c[name] = value
        editor.changed(overrides, c)
    }

    function inherited(field) {
        return field.globalValue !== undefined ? field.globalValue : field.fallback
    }

    function effective(field) {
        return (editor.overrides && editor.overrides[field.key] !== undefined)
            ? editor.overrides[field.key] : inherited(field)
    }

    function customVal(name, fallback) {
        return editor.customValues[name] !== undefined ? editor.customValues[name] : fallback
    }

    spacing: 6

    Repeater {
        model: editor.fields
        delegate: RowLayout {
            id: fieldRow
            property var field: modelData
            Layout.fillWidth: true
            spacing: 8

            CheckBox {
                id: enableBox
                checked: editor.overrides && editor.overrides[field.key] !== undefined
                onClicked: {
                    if (checked) editor.setOverride(field.key, editor.inherited(field))
                    else editor.clearOverride(field.key)
                    checked = Qt.binding(function() {
                        return editor.overrides && editor.overrides[field.key] !== undefined
                    })
                }
                ToolTip.visible: hovered
                ToolTip.text: "Override global setting"
            }
            Label {
                text: field.label
                color: AppState.colors.fg
                Layout.fillWidth: true
                opacity: enableBox.checked ? 1 : 0.6
            }

            ComboBox {
                visible: field.control === "select"
                enabled: enableBox.checked
                model: field.options || []
                textRole: "label"
                valueRole: "value"
                Layout.preferredWidth: 120
                currentIndex: {
                    var v = editor.effective(field)
                    var i = model.findIndex(function(o){ return o.value === v })
                    return i >= 0 ? i : 0
                }
                onActivated: {
                    editor.setOverride(field.key, model[currentIndex].value)
                    currentIndex = Qt.binding(function() {
                        var v = editor.effective(field)
                        var i = model.findIndex(function(o){ return o.value === v })
                        return i >= 0 ? i : 0
                    })
                }
            }
            RowLayout {
                visible: field.control === "slider"
                enabled: enableBox.checked
                Slider {
                    id: fieldSlider
                    from: field.min !== undefined ? field.min : 0
                    to: field.max !== undefined ? field.max : 100
                    stepSize: 1
                    value: Number(editor.effective(field)) || 0
                    onMoved: {
                        editor.setOverride(field.key, Math.round(value))
                        value = Qt.binding(function() { return Number(editor.effective(field)) || 0 })
                    }
                    Layout.preferredWidth: 120
                }
                Label {
                    text: Math.round(Number(editor.effective(field)) || 0) + (field.suffix || "")
                    color: AppState.colors.mutedFg
                    Layout.preferredWidth: 44
                    horizontalAlignment: Text.AlignRight
                }
            }
            Switch {
                visible: field.control === "switch"
                enabled: enableBox.checked
                checked: !!editor.effective(field)
                onClicked: {
                    editor.setOverride(field.key, checked)
                    checked = Qt.binding(function() { return !!editor.effective(field) })
                }
            }
        }
    }

    // ── Custom properties from project.json ────────────────────────────
    Label {
        visible: editor.properties.length > 0
        text: "Wallpaper properties"
        font.bold: true
        font.pixelSize: 12
        color: AppState.colors.mutedFg
        Layout.topMargin: 8
    }

    Repeater {
        model: editor.properties
        delegate: RowLayout {
            id: propRow
            property var prop: modelData
            Layout.fillWidth: true
            spacing: 8
            Label {
                text: prop.text || prop.name
                color: AppState.colors.fg
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
            }
            Switch {
                visible: prop.type === "bool"
                checked: {
                    var v = editor.customVal(prop.name, prop.value)
                    return v === "1" || v === "true" || v === true
                }
                onClicked: {
                    editor.setCustom(prop.name, checked ? "1" : "0")
                    checked = Qt.binding(function() {
                        var v = editor.customVal(prop.name, prop.value)
                        return v === "1" || v === "true" || v === true
                    })
                }
            }
            RowLayout {
                visible: prop.type === "slider"
                Slider {
                    from: prop.min !== undefined ? prop.min : 0
                    to: prop.max !== undefined ? prop.max : 100
                    stepSize: prop.step !== undefined ? prop.step : 1
                    value: Number(editor.customVal(prop.name, prop.value)) || 0
                    onMoved: {
                        editor.setCustom(prop.name, String(value))
                        value = Qt.binding(function() {
                            return Number(editor.customVal(prop.name, prop.value)) || 0
                        })
                    }
                    Layout.preferredWidth: 140
                }
                Label {
                    text: Number(editor.customVal(prop.name, prop.value)) || 0
                    color: AppState.colors.mutedFg
                    Layout.preferredWidth: 50
                    horizontalAlignment: Text.AlignRight
                }
            }
            ComboBox {
                visible: prop.type === "combo"
                model: prop.options || []
                textRole: "label"
                Layout.preferredWidth: 160
                currentIndex: {
                    var v = editor.customVal(prop.name, prop.value)
                    var i = model.findIndex(function(o){ return o.value === v })
                    return i >= 0 ? i : 0
                }
                onActivated: {
                    editor.setCustom(prop.name, model[currentIndex].value)
                    currentIndex = Qt.binding(function() {
                        var v = editor.customVal(prop.name, prop.value)
                        var i = model.findIndex(function(o){ return o.value === v })
                        return i >= 0 ? i : 0
                    })
                }
            }
            RowLayout {
                visible: prop.type === "color"
                spacing: 6
                Rectangle {
                    width: 28; height: 28; radius: 4
                    border.color: AppState.colors.border
                    color: {
                        var v = String(editor.customVal(prop.name, prop.value)).trim()
                        var parts = v.split(/\s+/)
                        if (parts.length >= 3 && !isNaN(Number(parts[0])))
                            return Qt.rgba(Number(parts[0]), Number(parts[1]), Number(parts[2]), 1)
                        return v || "transparent"
                    }
                }
                Button {
                    text: "Pick"
                    onClicked: colorDialog.open()
                }
                ColorDialog {
                    id: colorDialog
                    onAccepted: {
                        var c = selectedColor
                        editor.setCustom(prop.name,
                            (Math.round(c.r * 1000) / 1000) + " " +
                            (Math.round(c.g * 1000) / 1000) + " " +
                            (Math.round(c.b * 1000) / 1000))
                    }
                }
            }
            TextField {
                visible: prop.type === "textinput"
                text: editor.customVal(prop.name, prop.value)
                onEditingFinished: editor.setCustom(prop.name, text)
                Layout.preferredWidth: 160
            }
        }
    }
}
