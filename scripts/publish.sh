#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
WRAPPER_ROOT="${TMPDIR:-/tmp}/linux-wallpaper-engine-rpm"
WRAPPER_BIN="$WRAPPER_ROOT/bin"
RPM_DB="$WRAPPER_ROOT/rpmdb"
REAL_RPMBUILD="$(command -v rpmbuild || true)"
REAL_RPM="$(command -v rpm || true)"
DEBUG_NAMESPACES="electron-installer-flatpak,flatpak-bundler"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "$REAL_RPMBUILD" ]]; then
  echo "Missing rpmbuild. On Arch, install it with: sudo pacman -S rpm-tools" >&2
  exit 127
fi

if [[ -z "$REAL_RPM" ]]; then
  echo "Missing rpm. On Arch, install it with: sudo pacman -S rpm-tools" >&2
  exit 127
fi

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
electron-forge publish
