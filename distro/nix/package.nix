{
  lib,
  stdenv,
  runCommand,
  bun2nix,

  nodejs,
  imagemagick,
  makeWrapper,
  copyDesktopItems,
  makeDesktopItem,

  linux-wallpaperengine,
  xrandr,
  wlr-randr,
  gnome-randr,
  ffmpeg-headless,
  coreutils,
  procps,
  which,
  file,

  src,
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
bun2nix.mkDerivation rec {
  pname = package.name;
  version = package.version;
  module = package.main;
  inherit src;

  bunDeps = bun2nix.fetchBunDeps { bunNix = ./bun.nix; };

  bunInstallFlags =
    if stdenv.hostPlatform.isDarwin then
      [
        "--linker=hoisted"
        "--backend=copyfile"
      ]
    else
      [ "--linker=hoisted" ];

  nativeBuildInputs = [
    nodejs
    imagemagick
    makeWrapper
    copyDesktopItems
  ];

  buildPhase = ''
    # bash
    runHook preBuild

    # Sanity check, should typically match already
    export ELECTRON_VER="${electron.version}"
    echo "Syncing Electron version to Nixpkgs' version (v$ELECTRON_VER)"
    sed -i "s/\"electron\": \"[^\"]*\"/\"electron\": \"$ELECTRON_VER\"/" package.json

    export CI=true
    echo "Packaging..."
    bun run build
    # Pack with Nixpkgs' Electron instead of downloading one. electron-builder writes
    # fuses into the Electron binary it copies, so hand it a writable copy.
    cp -r ${electron}/libexec/electron "$TMPDIR/electron-dist"
    chmod -R u+w "$TMPDIR/electron-dist"
    node node_modules/.bin/electron-builder --dir \
      -c.electronDist="$TMPDIR/electron-dist" \
      -c.electronVersion=${electron.version}

    runHook postBuild
  '';

  installPhase = ''
    # bash
    runHook preInstall

    mkdir -p $out/share/${pname}
    mkdir -p $out/share/pixmaps
    mkdir -p $out/bin

    # Copy resources
    cp -a release/linux-unpacked/resources/. $out/share/${pname}/

    # Copy the icon so the .desktop file can find it
    cp assets/transparent-logo.png $out/share/pixmaps/${pname}.png

    # Wrap the binary with runtime deps
    makeWrapper ${electron}/bin/electron $out/bin/${pname} \
      --add-flags "$out/share/${pname}/app.asar" \
      --prefix PATH : ${lib.makeBinPath appRuntime}

    runHook postInstall
  '';

  desktopItems = [
    (makeDesktopItem {
      name = pname;
      exec = pname;
      icon = pname;
      desktopName = package.productName;
      comment = package.description;
      categories = [ "Utility" ];
    })
  ];

  meta = with lib; {
    description = package.description;
    homepage = package.homepage;
    license = licenses.mit;
    platforms = platforms.all;
    mainProgram = pname;
  };
}
