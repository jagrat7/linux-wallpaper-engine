#!/usr/bin/env bash
# Installs a release package in a clean distro container, checks its desktop
# integration, launches it as a normal user under Xvfb, and drives it with
# smoke-app.mjs. No GPU and no linux-wallpaperengine: this proves the package
# installs and the app starts, not that wallpapers render.
#
# Usage: distro-smoke.sh <debian|fedora|arch> <forge out/make dir> <output dir>
# Needs docker, node, and `dev/verify/lwe setup` (playwright-core).
set -euo pipefail

distro="${1:-}"
make_dir="${2:-}"
out_dir="${3:-}"
case "$distro" in
  debian) image=debian:12 ;;
  fedora) image=fedora:42 ;;
  arch) image=archlinux:latest ;;
  *)
    echo "usage: $0 <debian|fedora|arch> <make dir> <output dir>" >&2
    exit 2
    ;;
esac
[[ -d "$make_dir" && -n "$out_dir" ]] || {
  echo "usage: $0 <debian|fedora|arch> <make dir> <output dir>" >&2
  exit 2
}

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
make_dir="$(realpath "$make_dir")"
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

log "$distro: starting $image"
# --network host: smoke-app.mjs on the host reaches the app's CDP port on 127.0.0.1.
# Unconfined seccomp/AppArmor lets Chromium create the user namespaces its sandbox
# needs, as it can on a desktop; Docker's defaults block them.
docker run -d --name "$name" --network host --shm-size=1g \
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined \
  -v "$make_dir:/make:ro" -v "$repo/distro/aur:/aur:ro" -v "$repo/LICENSE:/LICENSE:ro" \
  "$image" sleep infinity >/dev/null
container_ok=1

log "$distro: installing the package"
case "$distro" in
  debian)
    in_root 'apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /make/deb/x64/*.deb xvfb xauth procps >/dev/null'
    pkg_files='dpkg -L linux-wallpaper-engine'
    ;;
  fedora)
    in_root 'dnf install -y -q /make/rpm/x64/*.rpm xorg-x11-server-Xvfb xorg-x11-xauth procps-ng shadow-utils >/dev/null'
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
      cp /make/zip/linux/x64/*.zip wallpaperx-bin-$version.zip
      cp /LICENSE LICENSE-$version
      chown -R builder /home/builder/pkg
      sudo -u builder makepkg -d --skipchecksums --noconfirm >/dev/null
      pacman -Udd --noconfirm wallpaperx-bin-*.pkg.tar.zst >/dev/null"
    pkg_files="pacman -Qlq wallpaperx-bin"
    ;;
esac
in_root 'useradd -m tester'

log "$distro: checking the installed desktop entry"
# The launcher must start something that exists, with an icon the desktop can find.
desktop_exec="$(in_root "
  entry=\$($pkg_files | grep -m1 '^/usr/share/applications/.*\.desktop\$')
  echo \"desktop entry: \$entry\" >&2
  cmd=\$(sed -n 's/^Exec=//p' \"\$entry\" | head -1 | awk '{print \$1}' | tr -d '\"')
  icon=\$(sed -n 's/^Icon=//p' \"\$entry\" | head -1)
  command -v \"\$cmd\" >/dev/null || { echo \"Exec=\$cmd is not runnable\" >&2; exit 1; }
  if [[ \"\$icon\" == /* ]]; then test -f \"\$icon\"
  else find /usr/share/icons /usr/share/pixmaps -name \"\$icon.*\" 2>/dev/null | grep -q .
  fi || { echo \"Icon=\$icon not found\" >&2; exit 1; }
  echo \"Exec=\$cmd and Icon=\$icon resolve\" >&2
  echo \"\$cmd\"
")"

log "$distro: launching $desktop_exec as an unprivileged user"
in_user "cd ~ && setsid nohup xvfb-run -a -s '-screen 0 1280x800x24' \
  $desktop_exec --remote-debugging-port=$port >app.log 2>&1 </dev/null &"

node "$repo/scripts/ci/smoke-app.mjs" "$port" "$out_dir"

log "$distro: checking the autostart entry the app wrote"
in_user '
  entry=$(ls ~/.config/autostart/*.desktop)
  cat "$entry"
  exec_line=$(sed -n "s/^Exec=//p" "$entry")
  # Exec is either a quoted absolute path or a command on PATH
  cmd=$(printf "%s" "$exec_line" | sed -E "s/^\"([^\"]*)\".*/\1/; t; s/ .*//")
  if [[ "$cmd" == /* ]]; then test -x "$cmd"; else command -v "$cmd" >/dev/null; fi ||
    { echo "autostart Exec=$exec_line does not point at a runnable file" >&2; exit 1; }
  echo "autostart Exec resolves to $cmd"
' | tee "$out_dir/autostart.txt"

in_root 'pkill -u tester || true'
log "$distro: passed"
