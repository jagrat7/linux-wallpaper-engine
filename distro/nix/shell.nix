{
  mkShell,

  bun,
  nodejs,
  imagemagick,
  bun2nix,
  nix-output-monitor,

  linux-wallpaperengine,
  xrandr,
  wlr-randr,
  gnome-randr,
  ffmpeg-headless,
  coreutils,
  procps,
  which,
  file,

  package,
  electron,
}:
let
  appRuntime = [
    linux-wallpaperengine
    xrandr
    wlr-randr
    gnome-randr
    ffmpeg-headless
    coreutils
    procps
    which
    file
  ];
in
mkShell {
  name = "${package.name}-dev";

  buildInputs = [
    # Core
    bun
    nodejs
    electron
    imagemagick

    # Nix
    bun2nix
    nix-output-monitor
  ]
  ++ appRuntime;

  shellHook =
    let
      electronOffline = ''
        # bash
        # Do not download unpatched Electron
        export ELECTRON_SKIP_BINARY_DOWNLOAD=1

        # Instead point the electron package at Nixpkgs' Electron; require('electron') reads this
        export ELECTRON_OVERRIDE_DIST_PATH="$DEV_TEMP_DIR/${package.name}-electron"
        mkdir -p "$ELECTRON_OVERRIDE_DIST_PATH"

        ln -snf ${electron}/bin/electron "$ELECTRON_OVERRIDE_DIST_PATH/electron"
        ln -snf ${electron}/libexec/electron/resources "$ELECTRON_OVERRIDE_DIST_PATH/resources"
        ln -snf ${electron}/libexec/electron/locales "$ELECTRON_OVERRIDE_DIST_PATH/locales"
      '';
    in
    ''
      # bash
      PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
      export DEV_TEMP_DIR="$PROJECT_ROOT/.direnv/tmp"
      mkdir -p "$DEV_TEMP_DIR"
      ${electronOffline}
    '';
}
