import QtQuick
import QtQuick.Shapes

// Paints the four corner wedges (outside a rounded rect, inside the item
// bounds) in `maskColor` — makes square children read as rounded without
// needing shader/effect layers, which don't render under all platforms.
Shape {
    id: root
    property int radius: 10
    property color maskColor: "#000000"
    preferredRendererType: Shape.CurveRenderer

    readonly property string _path: {
        var w = width, h = height, r = Math.min(radius, w / 2, h / 2)
        if (w <= 0 || h <= 0) return ""
        return "M0 0H" + w + "V" + h + "H0Z "
             + "M" + r + " 0H" + (w - r) + "Q" + w + " 0 " + w + " " + r
             + "V" + (h - r) + "Q" + w + " " + h + " " + (w - r) + " " + h
             + "H" + r + "Q0 " + h + " 0 " + (h - r) + "V" + r + "Q0 0 " + r + " 0Z"
    }

    ShapePath {
        fillColor: root.maskColor
        fillRule: ShapePath.OddEvenFill
        strokeWidth: -1
        strokeColor: "transparent"
        PathSvg { path: root._path }
    }
}
