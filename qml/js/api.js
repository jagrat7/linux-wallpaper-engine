// Thin client for the lwe-daemon HTTP interface.
// POST /rpc {path, input} -> {result|error}
// GET /events/poll?since=N&wait=ms -> {events, latest} (long-poll)

var BASE = "http://127.0.0.1:48734"

// Override the daemon endpoint, e.g. `qml6 qml/main.qml --daemon=http://host:port`
function setBase(url) { BASE = url }
function base() { return BASE }

function rpc(path, input, onOk, onErr) {
    var xhr = new XMLHttpRequest()
    xhr.open("POST", BASE + "/rpc")
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== XMLHttpRequest.DONE) return
        var res = null
        try { res = JSON.parse(xhr.responseText) } catch (e) { /* fallthrough */ }
        if (!res || res.error) {
            var err = (res && res.error) || { code: "NETWORK", message: "Daemon unreachable" }
            if (onErr) onErr(err)
            else console.warn("[rpc] " + path + " -> " + err.message)
        } else if (onOk) {
            onOk(res.result)
        }
    }
    var body = { path: path }
    if (input !== undefined && input !== null) body.input = input
    xhr.send(JSON.stringify(body))
}

function health(onOk, onErr) {
    var xhr = new XMLHttpRequest()
    xhr.open("GET", BASE + "/health")
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== XMLHttpRequest.DONE) return
        try {
            var res = JSON.parse(xhr.responseText)
            if (res.status === "ok") { if (onOk) onOk(res); return }
        } catch (e) { /* fallthrough */ }
        if (onErr) onErr()
    }
    xhr.send()
}

// One long-poll round. Calls onEvents(events, latestSeq) then the caller is
// expected to poll again with the new `since`.
function pollEvents(since, onEvents, onErr) {
    var xhr = new XMLHttpRequest()
    xhr.open("GET", BASE + "/events/poll?since=" + since + "&wait=25000")
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== XMLHttpRequest.DONE) return
        try {
            var res = JSON.parse(xhr.responseText)
            if (res && res.events !== undefined) { onEvents(res.events, res.latest); return }
        } catch (e) { /* fallthrough */ }
        if (onErr) onErr()
    }
    xhr.send()
}

function fileUrl(path) {
    if (!path) return ""
    if (path.indexOf("file://") === 0 || path.indexOf("http://") === 0 || path.indexOf("https://") === 0) return path
    var encoded = path.split("/").map(encodeURIComponent).join("/")
    return "file://" + encoded
}

// Workshop pagination cursor: btoa(JSON.stringify({p: page}))
var _b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
function btoa(input) {
    var str = String(input), output = "", i = 0
    while (i < str.length) {
        var c1 = str.charCodeAt(i++), c2 = str.charCodeAt(i++), c3 = str.charCodeAt(i++)
        var e1 = c1 >> 2
        var e2 = ((c1 & 3) << 4) | (c2 >> 4)
        var e3 = ((c2 & 15) << 2) | (c3 >> 6)
        var e4 = c3 & 63
        if (isNaN(c2)) { e3 = e4 = 64 } else if (isNaN(c3)) { e4 = 64 }
        output += _b64chars.charAt(e1) + _b64chars.charAt(e2) + _b64chars.charAt(e3) + _b64chars.charAt(e4)
    }
    return output
}

function workshopCursor(page) {
    return btoa(JSON.stringify({ p: page }))
}

var COMPAT_COLORS = {
    perfect: "#22c55e",
    minor: "#eab308",
    major: "#f97316",
    broken: "#ef4444",
    unknown: "#6b7280"
}

var COMPAT_LABELS = {
    perfect: "Perfect",
    minor: "Minor Issues",
    major: "Major Issues",
    broken: "Broken",
    unknown: "Unknown"
}

var TYPE_LABELS = { scene: "Scene", video: "Video", web: "Web", application: "Application" }

var AGE_LABELS = { g: "G", pg13: "PG13", r: "R" }
