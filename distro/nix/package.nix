{
  lib,
  stdenv,
  runCommand,
  bun2nix,

  zip,
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

  # for Forge offline hack
  electronZipDir =
    runCommand "electron-v${electron.version}-zip-dir"
      { nativeBuildInputs = [ zip ]; }
      ''
        # bash
        mkdir -p $out
        TMP_DIR=$(mktemp -d)
        cp -r ${electron}/libexec/electron/* $TMP_DIR/
        chmod -R u+w $TMP_DIR
        cd $TMP_DIR
        zip -0 -r -y $out/electron-v${electron.version}-linux-x64.zip .
      '';
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

    # Only way I found to bypass Forge connecting to the internet
    # is by injecting a zipped version of Electron to Forge's config
    export ELECTRON_ZIP_DIR="${electronZipDir}"
    sed -i 's/packagerConfig: {/packagerConfig: { electronZipDir: process.env.ELECTRON_ZIP_DIR,/' forge.config.ts

    # Sanity check, should typically match already
    export ELECTRON_VER="${electron.version}"
    echo "Syncing Electron version to Nixpkgs' version (v$ELECTRON_VER)"
    sed -i "s/\"electron\": \"[^\"]*\"/\"electron\": \"$ELECTRON_VER\"/" package.json

    export CI=true
    echo "Packaging..."
    bun package

    runHook postBuild
  '';

  installPhase = ''
    # bash
    runHook preInstall

    mkdir -p $out/share/${pname}
    mkdir -p $out/share/pixmaps
    mkdir -p $out/bin

    # Copy resources
    cp -a out/*/resources/. $out/share/${pname}/

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
