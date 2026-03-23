{
  lib,
  mkShell,

  bun,
  nodejs,
  imagemagick,
  bun2nix,
  nix-output-monitor,

  rpm,
  zip,
  dpkg,
  fakeroot,
  flatpak,
  flatpak-builder,
  elfutils,

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

    # Forge Maker
    zip
    dpkg
    fakeroot
    flatpak
    flatpak-builder
    elfutils
  ]
  ++ appRuntime;

  shellHook =
    let
      electronOffline = ''
        # bash
        # Do not download unpatched Electron
        export ELECTRON_SKIP_BINARY_DOWNLOAD=1

        # Instead create an override in tmp with symlinks
        export ELECTRON_OVERRIDE_DIST_PATH="/tmp/${package.name}-electron"
        mkdir -p "$ELECTRON_OVERRIDE_DIST_PATH"

        ln -snf ${electron}/bin/electron "$ELECTRON_OVERRIDE_DIST_PATH/electron"
        ln -snf ${electron}/libexec/electron/resources "$ELECTRON_OVERRIDE_DIST_PATH/resources"
        ln -snf ${electron}/libexec/electron/locales "$ELECTRON_OVERRIDE_DIST_PATH/locales"
      '';

      mkWraperForRpm =
        bin: wrapper:
        let
          target = "$RPM_WRAPPER_DIR/bin/${bin}";
        in
        ''
          cat <<EOF > ${target}
          #!/bin/sh
          ${wrapper}
          EOF
          chmod +x ${target}
        '';

      rpmbuildWrapper = mkWraperForRpm "rpmbuild" ''
        # bash
        # electron-forge dynamically generates a .spec file and passes it to rpmbuild.
        # We need to intercept this file path from the arguments so we can patch it.
        SPEC_FILE=""
        for arg in "\$@"; do
            if [[ "\$arg" == *.spec ]]; then
                SPEC_FILE="\$arg"
                break
            fi
        done

        if [ -n "\$SPEC_FILE" ]; then
            # electron-installer-redhat dumps our files in the 'BUILD/' folder.
            # Modern rpmbuild auto-enters a nested 'BUILD/app-version-build/' folder.
            # We inject 'cd ..' right after the %install phase starts so the 
            # hardcoded 'cp' commands can successfully find the 'usr/' folder.
            sed -i 's/^%install.*/&\ncd ../g' "\$SPEC_FILE"
        fi

        # Execute the real rpmbuild, but force it to use our local, user-owned 
        # database in /tmp instead of crashing on the root-owned /var/lib/rpm.
        exec ${lib.getExe' rpm "rpmbuild"} --define "_dbpath $LOCAL_RPM_DB" "\$@"
      '';

      rpmWrapper = mkWraperForRpm "rpm" ''
        # bash
        # Also wrap the base 'rpm' command to use our local database, 
        # as electron-forge sometimes calls it to check system compatibility.
        exec ${lib.getExe' rpm "rpm"} --dbpath "$LOCAL_RPM_DB" "\$@"
      '';

      rpmOnNixHack = ''
        # bash
        # Workaround for RPM's hardcoded reliance on global system state
        export RPM_WRAPPER_DIR="/tmp/${package.name}-rpmbuild"
        export LOCAL_RPM_DB="$RPM_WRAPPER_DIR/rpmdb"

        mkdir -p "$RPM_WRAPPER_DIR/bin"
        mkdir -p "$LOCAL_RPM_DB"

        ${rpmbuildWrapper}
        ${rpmWrapper}

        # Prepend our wrapped binaries so they override
        export PATH="$RPM_WRAPPER_DIR/bin:$PATH"
      '';

      userShell = ''
        # bash
        # Clean up on exit
        CLEANUP_CMD="rm -rf $ELECTRON_OVERRIDE_DIST_PATH $RPM_WRAPPER_DIR"

        # Find user's shell if set, since $SHELL gets stripped
        if command -v getent >/dev/null 2>&1; then
          USER_SHELL=$(getent passwd "$USER" | cut -d: -f7)
        elif [ -f /etc/passwd ]; then
          USER_SHELL=$(grep "^$USER:" /etc/passwd | cut -d: -f7)
        fi

        # Run preferred shell if found and in interactive mode
        if [[ -n "$USER_SHELL" && "$USER_SHELL" != *"bash"* && $- == *i* ]]; then
          "$USER_SHELL"
          eval "$CLEANUP_CMD"
          exit

        # If falling back to bash, use a trap to clean up on exit
        else
          trap "$CLEANUP_CMD" EXIT
        fi
      '';
    in
    ''
      ${electronOffline}
      ${rpmOnNixHack}
      ${userShell}
    '';
}
