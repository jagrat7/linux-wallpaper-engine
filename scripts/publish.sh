#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
FORGE_CLI="$PROJECT_ROOT/node_modules/.bin/electron-forge"
BUN_BIN="$(command -v bun || true)"
FORGE_COMMAND="${1:-publish}"
WRAPPER_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/linux-wallpaper-engine-rpm.XXXXXX")"
WRAPPER_BIN="$WRAPPER_ROOT/bin"
RPM_DB="$WRAPPER_ROOT/rpmdb"
DEBUG_NAMESPACES="electron-installer-flatpak,flatpak-bundler"

cleanup() {
  rm -rf -- "$WRAPPER_ROOT"
}

trap cleanup EXIT

if [[ "$FORGE_COMMAND" != "make" && "$FORGE_COMMAND" != "publish" ]]; then
  echo "Usage: $0 [make|publish]" >&2
  exit 2
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ ! -x "$FORGE_CLI" ]]; then
  echo "Electron Forge is not installed. Run: bun install" >&2
  exit 1
fi

if [[ -z "$BUN_BIN" ]]; then
  echo "Bun is not installed." >&2
  exit 1
fi

if [[ "$FORGE_COMMAND" == "publish" && -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Missing GITHUB_TOKEN. Export it or add it to $ENV_FILE." >&2
  exit 1
fi

REQUIRED_BINARIES=(dpkg fakeroot rpmbuild rpm flatpak-builder eu-strip)
MISSING_BINARIES=()

for binary in "${REQUIRED_BINARIES[@]}"; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    MISSING_BINARIES+=("$binary")
  fi
done

if (( ${#MISSING_BINARIES[@]} > 0 )); then
  echo "Missing packaging tools: ${MISSING_BINARIES[*]}" >&2
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
  fi
  if [[ "${ID:-} ${ID_LIKE:-}" == *arch* ]]; then
    echo "Install them with: sudo pacman -S --needed dpkg fakeroot rpm-tools flatpak-builder elfutils" >&2
  else
    echo "Install the distro packages that provide the missing binaries, then retry." >&2
  fi
  exit 127
fi

REAL_RPMBUILD="$(command -v rpmbuild)"
REAL_RPM="$(command -v rpm)"

mkdir -p "$WRAPPER_BIN" "$RPM_DB"

cat > "$WRAPPER_BIN/rpmbuild" <<EOF
#!/usr/bin/env bash
set -euo pipefail

SPEC_FILE=""
for arg in "\$@"; do
  if [[ "\$arg" == *.spec ]]; then
    SPEC_FILE="\$arg"
    break
  fi
done

if [[ -n "\$SPEC_FILE" ]]; then
  sed -i 's/^%install.*/&\\ncd ../g' "\$SPEC_FILE"
fi

exec "$REAL_RPMBUILD" --define "_dbpath $RPM_DB" "\$@"
EOF

cat > "$WRAPPER_BIN/rpm" <<EOF
#!/usr/bin/env bash
set -euo pipefail

exec "$REAL_RPM" --dbpath "$RPM_DB" "\$@"
EOF

chmod +x "$WRAPPER_BIN/rpmbuild" "$WRAPPER_BIN/rpm"

export PATH="$WRAPPER_BIN:$PATH"
export DEBUG="${DEBUG:-$DEBUG_NAMESPACES}"

cd "$PROJECT_ROOT"
"$BUN_BIN" "$FORGE_CLI" "$FORGE_COMMAND"
