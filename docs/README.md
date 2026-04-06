
## Overview

[![GitHub Downloads](https://img.shields.io/github/downloads/jagrat7/linux-wallpaper-engine/total?style=for-the-badge&logo=linux&logoColor=white&label=Downloads)](https://github.com/jagrat7/linux-wallpaper-engine/releases) [![GitHub Release](https://img.shields.io/github/v/release/jagrat7/linux-wallpaper-engine?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/jagrat7/linux-wallpaper-engine/releases/latest) [![GitHub Stars](https://img.shields.io/github/stars/jagrat7/linux-wallpaper-engine?style=for-the-badge&logo=starship&logoColor=white)](https://github.com/jagrat7/linux-wallpaper-engine/stargazers)

This is a modern UI wrapper for [linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine). This app has most features of [linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine) plus some additional features(like compatibility tagging for wallpapers) for a better user experience. Also a shoutout to [simple-linux-wallpaperengine-gui](https://github.com/Maxnights/simple-linux-wallpaperengine-gui), which I referenced for CLI commands.

![Overview](preview.gif)

---

### 📑 Table of Contents

- [Installation](#-installation)
- [Features](#-features)
- [Future Features](#-future-features)
- [Contributing & Feedback](#-contributing--feedback)

---

## 📦 Installation

### 1. Wallpaper Engine (Steam)

You need to own and install [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/) on Steam. Open Wallpaper Engine via Steam so the wallpapers are downloaded to your system.

### 2. Install linux-wallpaperengine

You need to go to the [linux-wallpaperengine repo](https://github.com/Almamu/linux-wallpaperengine) page and follow the build instructions to compile and install it. Please read carefully and make sure it supports your OS and configuration — if it doesn't, this app is useless. Wayland works with compositors that support wlr-layer-shell-unstable, while X11 requires XRandr and `--screen-root <screen_name>` (as shown in `xrandr`) and currently does not work if a compositor or desktop environment (e.g. GNOME, KDE, Nautilus) is drawing the background.

Verify the installation:
```bash
linux-wallpaperengine --help
```

If you installed via build from source, you need to create a symlink (or copy) to make the binary accessible:

```bash
sudo ln -sf /path/to/your/build/linux-wallpaperengine /usr/local/bin/linux-wallpaperengine
```

Test if it is working on your system by applying a wallpaper with the cli. For example (you will need to find your own path to the wallpaper file and the screen name):
```bash
linux-wallpaperengine --screen-root DP-2 --bg /home/$USER/.local/share/Steam/steamapps/workshop/content/431960/<wallpaper_id>
```



### 3. Linux Wallpaper Engine UI

Grab the latest package from [GitHub Releases](https://github.com/jagrat7/linux-wallpaper-engine/releases) for your distro.

#### Debian / Ubuntu (.deb)

```bash
sudo apt install ./linux-wallpaper-engine_<version>_amd64.deb
```

#### Fedora / RHEL (.rpm)

```bash
sudo dnf install ./linux-wallpaper-engine-<version>.x86_64.rpm
```

#### Flatpak

```bash
flatpak install --user ./com.github.jagrat7.LinuxWallpaperEngine_stable_x86_64.flatpak
```

#### ZIP (Portable)

```bash
# Extract the archive (use your preferred tool: unzip, 7z, etc.)
unzip linux-wallpaper-engine-<version>-linux-x64.zip

# Run the executable
cd linux-wallpaper-engine-linux-x64
./linux-wallpaper-engine
```

#### Nix / NixOS (Flakes)

Run the app without installing (flakes must be enabled):

```bash
nix run github:jagrat7/linux-wallpaper-engine
```

On NixOS, add the flake as an input:

```nix
# flake.nix
{
  inputs = {
    linux-wallpaper-engine.url = "github:jagrat7/linux-wallpaper-engine";
    # ...
  }
  # your system outputs...
}
```

Then simply consume the package:

```nix
# in a NixOS system module...
{ inputs, pkgs, ... }:
{
  environment.systemPackages = [
    inputs.linux-wallpaper-engine.packages.${pkgs.stdenv.hostPlatform.system}.default
    # ...
  ];
}

# or in a home-manager module...
{ inputs, pkgs, ... }:
{
  home.packages = [
    inputs.linux-wallpaper-engine.packages.${pkgs.stdenv.hostPlatform.system}.default
    # ...
  ];
}
```



## ✨ Features

- **Wallpaper Gallery** — Browse all your Steam Workshop wallpapers in a responsive, animated grid with thumbnails. You can add filters and sorts to make it easier to find the wallpapers you want.
![Wallpaper Gallery](grid.png)

<br />

- **Playlists (NEW!)** —  You can create and apply playlists to group wallpapers together and apply them to your monitors.
![Playlist Support](playlists.png)

<br />

- **Compatibility/Errors tracking** —  You can manually tag the wallpapers as compatible or not from the settings or run the compatibility scanner to bulk-tag them, it's not 100% accurate but it will get you close. You can filter out wallpapers with errors or compatibility issues so you don't see them in the gallery.
![Compatibility Tag](comp-tag.png)
![Compatibility Scanner](comp-scan.png)

  - Wouldn't be a linux experience without it not working on your system. Enter **debug mode** when applying a wallpaper to see what's happening:
![Debug Mode](debug-mode.png)
![Flatpak Compatibility Settings](comp-add.png)
<br />

- **Multi-Monitor Support** — Detect all connected displays, apply different wallpapers per screen, and view your monitor layout at a glance
![Multi-Monitor Support](displays.png)

<br />

- **Theming** — Choose from Light, Dark, Steam, Hard Light, or System themes
![Theming](dark.png)
![Theming](steam.png)
![Theming](light-mode.png)

<br />

- **Settings** — Comprehensive options to tailor the application to your needs:
  - **Performance**: Manage resource usage with FPS limits, auto-pause on fullscreen, and startup preferences.
  - **Compatibility**: Built-in tool to scan and verify which Steam Workshop wallpapers run natively on Linux.
  - **Audio**: Control master volume, mute rules, and enable audio processing for reactive wallpapers.
  - **Display**: Adjust default scaling, toggle mouse interactions, and manage parallax effects.
  - **Appearance**: Switch themes (Light, Dark, Steam-like) and customize UI elements like the status bar.
  
![Settings](settings.png)

## 🔮 Future Features

- A single installation for both the backend and the UI.
- Make per-wallpaper settings dynamic.


## 🤝 Contributing & Feedback

Contributions and feedback are welcome! Checkout [Discussions](https://github.com/jagrat7/linux-wallpaper-engine/discussions) to vote on features, share ideas, or ask questions. You can also open an [issue](https://github.com/jagrat7/linux-wallpaper-engine/issues) or submit a pull request. See [CONTRIBUTING.md](../.github/CONTRIBUTING.md) for more info.
