#!/usr/bin/env bash
# Proves an AppImage updates itself: builds the current version and a newer one
# (99.0.0) that both read a local update feed, launches the current one on Debian 12,
# clicks "Update now" and "Restart to update", then checks the .AppImage file on
# disk became the new build and the app started again.
#
# Usage: appimage-update-smoke.sh <output dir>
# Needs `bun run build` done first, docker, node, python3 and `dev/verify/lwe setup`.
set -euo pipefail

out_dir="${1:?usage: $0 <output dir>}"
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$out_dir"
out_dir="$(realpath "$out_dir")"
work="$(mktemp -d)"
port="${SMOKE_CDP_PORT:-9444}"
feed_port="${SMOKE_FEED_PORT:-8765}"
name="lwe-update-smoke-$$"
feed_pid=""

cleanup() {
  docker exec "$name" bash -c 'cat /home/tester/app.log' >"$out_dir/app.log" 2>/dev/null || true
  docker rm -f "$name" >/dev/null 2>&1 || true
  [[ -n "$feed_pid" ]] && kill "$feed_pid" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

log() { printf '\n== %s\n' "$*"; }

log "building the current and a newer AppImage against a local update feed"
# The same config, with the GitHub feed swapped for a local one. publish: is the
# last block of electron-builder.yml, so everything from it on is replaced.
node -e '
  const fs = require("node:fs")
  const [config, out, url] = process.argv.slice(1)
  const text = fs.readFileSync(config, "utf8")
  const at = text.indexOf("\npublish:")
  if (at < 0) throw new Error("no publish: block in " + config)
  fs.writeFileSync(out, text.slice(0, at) + `\npublish:\n  provider: generic\n  url: ${url}\n`)
' "$repo/electron-builder.yml" "$work/electron-builder.yml" "http://127.0.0.1:$feed_port/"
build() {
  (cd "$repo" && node_modules/.bin/electron-builder --config "$work/electron-builder.yml" \
    --linux AppImage --publish never -c.directories.output="$work/$1" "${@:2}" >"$out_dir/build-$1.log" 2>&1)
}
build current
build newer -c.extraMetadata.version=99.0.0
grep -q '^version: 99.0.0$' "$work/newer/latest-linux.yml"

log "serving the newer build as the update feed"
python3 -m http.server "$feed_port" --bind 127.0.0.1 --directory "$work/newer" >"$out_dir/feed.log" 2>&1 &
feed_pid=$!

log "launching the current AppImage on Debian 12"
# --network host: the app reaches the feed and smoke-app.mjs reaches CDP on 127.0.0.1.
docker run -d --name "$name" --network host --shm-size=1g \
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined \
  -v "$work:/builds:ro" debian:12 sleep infinity >/dev/null
docker exec "$name" bash -c 'apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb xauth procps libgtk-3-0 libnotify4 \
    libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0 libasound2 libgbm1 >/dev/null
  useradd -m tester'
docker exec -u tester "$name" bash -c 'mkdir -p ~/Applications
  cp /builds/current/*.AppImage ~/Applications/app.AppImage && chmod +x ~/Applications/app.AppImage'
# Containers have no FUSE, so the AppImage extracts itself and runs instead of mounting
docker exec -u tester -e HOME=/home/tester "$name" bash -c "cd ~ && APPIMAGE_EXTRACT_AND_RUN=1 \
  setsid nohup xvfb-run -n $port -s '-screen 0 1280x800x24' ~/Applications/app.AppImage \
  --remote-debugging-port=$port >app.log 2>&1 </dev/null &"

# The extracted app runs from /tmp/appimage_extracted_<hash of the AppImage>/; this
# matches its main process (launched with or without the CDP flag), not its helpers
app_process='/appimage_extracted_[^/ ]*/linux-wallpaper-engine( --remote-debugging-port=[0-9]+)?$'
running_app() { docker exec "$name" pgrep -u tester -af "$app_process" | awk '{print $2}' | sort -u; }
old_app=""
for _ in $(seq 1 60); do
  old_app="$(running_app || true)"
  [[ -n "$old_app" ]] && break
  sleep 1
done
[[ -n "$old_app" ]] || { echo "the current AppImage did not start" >&2; exit 1; }
node "$repo/scripts/ci/smoke-app.mjs" "$port" "$out_dir" update

log "checking the .AppImage file was replaced and the app started again"
for _ in $(seq 1 60); do
  docker exec "$name" bash -c 'cmp -s ~tester/Applications/app.AppImage /builds/newer/*.AppImage' && break
  sleep 2
done
docker exec "$name" bash -c 'cmp ~tester/Applications/app.AppImage /builds/newer/*.AppImage' ||
  { echo "the .AppImage file was not replaced with the new build" >&2; exit 1; }
echo "~/Applications/app.AppImage is now the 99.0.0 build"
# The new build extracts to a different folder, so a process from it is the relaunch
new_app=""
for _ in $(seq 1 30); do
  new_app="$(running_app | grep -v -F "$old_app" || true)"
  [[ -n "$new_app" ]] && break
  sleep 1
done
[[ -n "$new_app" ]] || { echo "the app did not start again after the update" >&2; exit 1; }
echo "relaunched: $new_app (was $old_app)"
grep -E 'GET /' "$out_dir/feed.log" || true

docker exec "$name" bash -c 'pkill -u tester || true'
log "AppImage update: passed"
