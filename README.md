
## Overview

[![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/jagrat7/linux-wallpaper-engine/total?style=flat-square&logo=github&label=Downloads)](https://github.com/jagrat7/linux-wallpaper-engine/releases) [![GitHub Release](https://img.shields.io/github/v/release/jagrat7/linux-wallpaper-engine?style=flat-square&logo=github)](https://github.com/jagrat7/linux-wallpaper-engine/releases/latest)

This is a modern UI wrapper for [linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine). This app has most features of [linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine) plus some additional features(like compatibility tagging for wallpapers) for a better user experience. Also a shoutout to [simple-linux-wallpaperengine-gui](https://github.com/Maxnights/simple-linux-wallpaperengine-gui), which I referenced for CLI commands.

![Overview](docs/preview.gif)

---

### 📑 Table of Contents

- [Installation](#-installation)
- [Features](#-features)
- [Future Features](#-future-features)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📦 Installation

### 1. Wallpaper Engine (Steam)

You need to own and install [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/) on Steam. Open Wallpaper Engine via Steam so the wallpapers are downloaded to your system.

### 2. Install linux-wallpaperengine

You need to go to the [linux-wallpaperengine repo](https://github.com/Almamu/linux-wallpaperengine) page and follow the build instructions to compile and install it. Please read carefully and make sure it supports your OS and configuration — if it doesn't, this app is useless.

Verify it works in your terminal:

```bash
linux-wallpaperengine
```

You might need to create a symlink to make the binary accessible in your `$PATH`:

```bash
# If installed to /opt (common)
sudo ln -sf /opt/linux-wallpaperengine/linux-wallpaperengine /usr/local/bin/linux-wallpaperengine

# Or from a custom build directory
sudo ln -sf /path/to/your/build/linux-wallpaperengine /usr/local/bin/linux-wallpaperengine
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

---

## ✨ Features

- **Wallpaper Gallery** — Browse all your Steam Workshop wallpapers in a responsive, animated grid with thumbnails. You can add filters and sorts to make it easier to find the wallpapers you want.
![Wallpaper Gallery](docs/grid.png)

<br />

- **Playlists (NEW!)** —  You can create and apply playlists to group wallpapers together and apply them to your monitors.
![Playlist Support](docs/playlists.png)

<br />

- **Compatibility/Errors Tags** —  You can manually tag the wallpapers as compatible or not from the settings or run the compatibility scanner to bulk-tag them, it's not 100% accurate but it will get you close. You can filter out wallpapers with errors or compatibility issues so you don't see them in the gallery.
![Compatibility Tag](docs/comp-tag.png)
![Compatibility Scanner](docs/comp-scan.png)

<br />

- **Multi-Monitor Support** — Detect all connected displays, apply different wallpapers per screen, and view your monitor layout at a glance
![Multi-Monitor Support](docs/displays.png)

<br />

- **Theming** — Choose from Light, Dark, Steam, Hard Light, or System themes
![Theming](docs/dark.png)
![Theming](docs/steam.png)
![Theming](docs/light-mode.png)

<br />

- **Settings** — Comprehensive options to tailor the application to your needs:
  - **Performance**: Manage resource usage with FPS limits, auto-pause on fullscreen, and startup preferences.
  - **Compatibility**: Built-in tool to scan and verify which Steam Workshop wallpapers run natively on Linux.
  - **Audio**: Control master volume, mute rules, and enable audio processing for reactive wallpapers.
  - **Display**: Adjust default scaling, toggle mouse interactions, and manage parallax effects.
  - **Appearance**: Switch themes (Light, Dark, Steam-like) and customize UI elements like the status bar.
  
![Settings](docs/settings.png)

## 🔮 Future Features

- Playlist support, cycle through wallpapers on a schedule or shuffle, probably using cron jobs or something similar.
- A single installation for both the backend and the UI.
- Make per-wallpaper settings dynamic.

---

## 🤝 Contributing & Feedback

Contributions and feedback are welcome! Open an [issue](https://github.com/jagrat7/linux-wallpaper-engine/issues) or submit a pull request.

### 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/jagrat7/linux-wallpaper-engine.git
cd linux-wallpaper-engine

# Install dependencies
bun install

# Start the app
bun start
```

You can check out my [react-electron-template](https://github.com/jagrat7/react-electron-template) for a more details on how I setup the app.

## 📄 License

[MIT](LICENSE) do whatever you want with it.
