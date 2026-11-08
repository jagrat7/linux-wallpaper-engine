#!/usr/bin/env bash
# Installs a release package in a clean distro container, checks its desktop
# integration, launches it as a normal user under Xvfb, and drives it with
# smoke-app.mjs. No GPU and no linux-wallpaperengine: this proves the package
# installs and the app starts, not that wallpapers render.
#
# Usage: distro-smoke.sh <debian|fedora|arch|appimage> <release dir> <output dir>
#   debian    the .deb on Debian 12
#   fedora    the .rpm on Fedora 42
#   arch      the AUR PKGBUILD (distro/aur), built from the release .zip
#   appimage  the .AppImage on Debian 12, the oldest glibc of the three
# Needs docker, node, and `dev/verify/lwe setup` (playwright-core).
set -euo pipefail

usage() {
  echo "usage: $0 <debian|fedora|arch|appimage> <release dir> <output dir>" >&2
  exit 2
}

distro="${1:-}"
release_dir="${2:-}"
out_dir="${3:-}"
case "$distro" in
  debian | appimage) image=debian:12 ;;
  fedora) image=fedora:42 ;;
  arch) image=archlinux:latest ;;
  *) usage ;;
esac
[[ -d "$release_dir" && -n "$out_dir" ]] || usage

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
release_dir="$(realpath "$release_dir")"
mkdir -p "$out_dir"
out_dir="$(realpath "$out_dir")"
version="$(node -p "require('$repo/package.json').version")"
port="${SMOKE_CDP_PORT:-9444}"
name="lwe-smoke-$distro-$$"

container_ok=0
cleanup() {
  if ((container_ok)); then
    docker exec "$name" bash -c 'cat /home/tester/app.log' >"$out_dir/app.log" 2>/dev/null || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log() { printf '\n== %s\n' "$*"; }
# Run as root, or as the unprivileged desktop user the app is launched as.
in_root() { docker exec "$name" bash -euo pipefail -c "$1"; }
in_user() { docker exec -u tester -e HOME=/home/tester "$name" bash -euo pipefail -c "$1"; }

# The first word of a desktop entry's Exec= value, honoring "quoted paths with spaces".
# Defined once and run inside the container.
exec_command='exec_command() { local v="$1"; if [[ "$v" == \"* ]]; then v="${v#\"}"; printf "%s" "${v%%\"*}"; else printf "%s" "${v%% *}"; fi; }'

log "$distro: starting $image"
# --network host: smoke-app.mjs on the host reaches the app's CDP port on 127.0.0.1.
# Unconfined seccomp/AppArmor lets Chromium create the user namespaces its sandbox
# needs, as it can on a desktop; Docker's defaults block them.
docker run -d --name "$name" --network host --shm-size=1g \
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined \
  -v "$release_dir:/release:ro" -v "$repo/distro/aur:/aur:ro" -v "$repo/LICENSE:/LICENSE:ro" \
  "$image" sleep infinity >/dev/null
container_ok=1

log "$distro: installing"
case "$distro" in
  debian)
    in_root 'apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /release/*.deb xvfb xauth procps >/dev/null'
    pkg_files='dpkg -L linux-wallpaper-engine'
    ;;
  fedora)
    in_root 'dnf install -y -q /release/*.rpm xorg-x11-server-Xvfb xorg-x11-xauth procps-ng shadow-utils >/dev/null'
    pkg_files='rpm -ql linux-wallpaper-engine'
    ;;
  arch)
    # Builds the AUR PKGBUILD from this run's zip instead of the published release.
    # -d skips linux-wallpaperengine, which is itself an AUR package.
    in_root "pacman -Syu --noconfirm --needed -q base-devel xorg-server-xvfb xorg-xauth alsa-lib gtk3 mesa nss >/dev/null
      useradd -m builder
      install -d -o builder /home/builder/pkg
      cd /home/builder/pkg
      cp /aur/wallpaperx-bin/PKGBUILD .
      sed -i 's/^pkgver=.*/pkgver=$version/' PKGBUILD
      cp /release/*-x64.zip wallpaperx-bin-$version.zip
      cp /LICENSE LICENSE-$version
      chown -R builder /home/builder/pkg
      sudo -u builder makepkg -d --skipchecksums --noconfirm >/dev/null
      pacman -Udd --noconfirm wallpaperx-bin-*.pkg.tar.zst >/dev/null"
    pkg_files="pacman -Qlq wallpaperx-bin"
    ;;
  appimage)
    # The libraries the .deb depends on; the AppImage bundles everything else.
    # Containers have no FUSE, so the AppImage extracts itself and runs instead of mounting.
    in_root 'apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb xauth procps libgtk-3-0 libnotify4 \
        libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0 libasound2 libgbm1 >/dev/null'
    ;;
esac
in_root 'useradd -m tester'

if [[ "$distro" == appimage ]]; then
  launch='~/Applications/app.AppImage'
  in_user 'mkdir -p ~/Applications && cp /release/*.AppImage ~/Applications/app.AppImage
    chmod +x ~/Applications/app.AppImage'
  launch_env='APPIMAGE_EXTRACT_AND_RUN=1'
else
  log "$distro: checking the installed desktop entry"
  # The launcher must start something that exists, with an icon the desktop can find.
  launch="$(in_root "$exec_command
    entry=\$($pkg_files | grep -m1 '^/usr/share/applications/.*\.desktop\$')
    echo \"desktop entry: \$entry\" >&2
    cmd=\$(exec_command \"\$(sed -n 's/^Exec=//p' \"\$entry\" | head -1)\")
    icon=\$(sed -n 's/^Icon=//p' \"\$entry\" | head -1)
    if [[ \"\$cmd\" == /* ]]; then test -x \"\$cmd\"; else command -v \"\$cmd\" >/dev/null; fi ||
      { echo \"Exec=\$cmd is not runnable\" >&2; exit 1; }
    if [[ \"\$icon\" == /* ]]; then test -f \"\$icon\"
    else find /usr/share/icons /usr/share/pixmaps -name \"\$icon.*\" 2>/dev/null | grep -q .
    fi || { echo \"Icon=\$icon not found\" >&2; exit 1; }
    echo \"Exec=\$cmd and Icon=\$icon resolve\" >&2
    printf '%q' \"\$cmd\"
  ")"
  launch_env=''
fi

log "$distro: launching $launch as an unprivileged user"
# A display number of our own: with --network host, X's abstract sockets are shared
# between containers, so parallel runs on one machine would collide on :99.
in_user "cd ~ && $launch_env setsid nohup xvfb-run -n $port -s '-screen 0 1280x800x24' \
  $launch --remote-debugging-port=$port >app.log 2>&1 </dev/null &"

node "$repo/scripts/ci/smoke-app.mjs" "$port" "$out_dir"

log "$distro: checking the autostart entry the app wrote"
in_user "$exec_command"'
  entry=$(ls ~/.config/autostart/*.desktop)
  cat "$entry"
  cmd=$(exec_command "$(sed -n "s/^Exec=//p" "$entry")")
  if [[ "$cmd" == /* ]]; then test -x "$cmd"; else command -v "$cmd" >/dev/null; fi ||
    { echo "autostart Exec does not point at a runnable file: $cmd" >&2; exit 1; }
  # An AppImage runs from a temporary mount; autostart must point at the .AppImage file
  if [[ '"$distro"' == appimage && "$cmd" != "$HOME/Applications/app.AppImage" ]]; then
    echo "autostart should start the .AppImage file, not $cmd" >&2; exit 1
  fi
  echo "autostart Exec resolves to $cmd"
' | tee "$out_dir/autostart.txt"

in_root 'pkill -u tester || true'
log "$distro: passed"
