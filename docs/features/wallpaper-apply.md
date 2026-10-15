# Apply wallpaper

Applying a wallpaper launches a `linux-wallpaperengine` process that renders it as the desktop background on one display or all of them. Once it's running, the status bar shows the active title and lets the user pause, mute or stop it. Per-wallpaper overrides change the arguments the process starts with. Displays shows what runs on each monitor.

## Sub-features

- `apply-primary`: the details panel's main button applies to the remembered screen, or to all displays (label `Apply` or `Apply · <screen>`).
- `apply-screen`: the split-button chevron lists each display (`DP-1`, ...) and `All displays`.
- `apply-stop`: once the wallpaper is active, the same button reads Stop and the chevron offers `Stop on <screen>` / `Stop all`.
- `statusbar-controls`: the footer shows `<screen>` and the active title, with `Pause wallpaper`/`Resume wallpaper`, `Mute`/`Unmute` and `Stop wallpaper`.
- `apply-overrides`: the details panel's Settings section (Scaling, Volume, mouse, parallax and particle switches, plus custom properties) saves to `wallpaper-overrides.json` and changes the next spawn's argv.
- `apply-window-mode`: with Settings → `Run in window mode` on, the wallpaper opens as a normal window (`--window WxHxXxY`) instead of `--screen-root`.
- `displays-view`: `/displays` shows the monitor layout and each display's current wallpaper and scaling.
- `apply-random-tray`: the tray menu's `Random Wallpaper` / `Pause` / `Resume` / `Stop Wallpaper`. Desktop target only, and it can't be driven over CDP.

## How to get to it (user POV)

- Installed → click a card → `Apply` in the details panel, or its chevron → a display.
- The status bar at the bottom of every page, for an active wallpaper.
- Sidebar `Displays` to inspect.
- The system tray menu, only when `Enable system tray` is on, in the desktop target.

## Driving it with lwe

Preconditions:

- `$LWE doctor` is healthy and `linux-wallpaperengine` is on PATH (`command -v linux-wallpaperengine`).
- `$LWE backends` reports `existed before launch (never touch): 0`. **If it isn't 0, stop and ask the user.** Applying to their screen kills their running wallpaper.
- Tell the user that this recipe changes their visible desktop wallpaper while it runs, unless you use window mode (below).
- To keep the desktop untouched, prefer window mode: in Settings, `$LWE drive click --row "Run in window mode"`. The wallpaper then opens as its own window. Remember that Stop in window mode runs a system-wide `pkill`, which is only safe because the backend count above is 0.

- **Before.** Run `$LWE drive text --css footer`, which prints `<screen> No active wallpaper`. `$LWE store active-wallpapers` shows no active entries.
- **Open details.** Search for and click a wallpaper titled `$T`, as in `installed-library.md`. Run `$LWE drive wait --role button --name Apply`.
- **Apply to one display.** Open the chevron and pick the display. The chevron is the unnamed button right after Apply: run `$LWE drive click --css 'xpath=//button[starts-with(normalize-space(.),"Apply")]/following-sibling::button[@aria-haspopup="menu"]'`, then `$LWE drive snapshot --css '[role=menu]'` to read the display names, then `$LWE drive click --role menuitem --name DP-1 --exact`. The button shows `Applying...`, then switches to the stop state. Run `$LWE drive wait --role button --name "Stop wallpaper" --within footer`, and the footer text contains `$T`.
- **Process side effect.** Run `pgrep -af linux-wallpaperengine`. Exactly one new process exists with `--screen-root DP-1 --bg <workshop id or path>` (or `--window ...` in window mode). `$LWE backends` lists it under "started by this run". `$LWE store active-wallpapers` has an `activeWallpapers.DP-1` entry and an `appliedHistory` stamp.
- **Pause / resume.** Run `$LWE drive click --role button --name "Pause wallpaper"`. The button becomes `Resume wallpaper`, the status dot turns warning-colored, and `ps -o stat= -p <pid>` shows `T` (SIGSTOP). Click `Resume wallpaper` and the stat leaves `T`.
- **Mute.** Run `$LWE drive click --role button --name Mute --exact`. The button becomes `Unmute` and `$LWE store settings | jq .silent` is `true`. The running process is respawned with `--silent` (check `pgrep -af`).
- **Override.** In the open details panel, `$LWE drive click --row "Disable parallax effect"`. `$LWE store wallpaper-overrides` gets an entry for the wallpaper path with `disableParallax: true`. Re-apply, and the argv contains `--disable-parallax`.
- **Displays.** Run `$LWE drive goto /displays`. The `DP-1` card shows `$T` instead of `No wallpaper`.
- **Stop.** Run `$LWE drive click --role button --name "Stop wallpaper"`. The footer returns to `No active wallpaper`, the process from the side-effect step is gone (`pgrep -af linux-wallpaperengine`), and `activeWallpapers` is empty.
- **Proof.** Before and after each step, capture `$LWE drive snapshot --css footer --path $A/<step>.aria.txt` and `$LWE drive screenshot --path $A/<step>.png`. Also save `pgrep -af linux-wallpaperengine > $A/<step>.procs.txt` and `$LWE store active-wallpapers > $A/<step>.active.json`. In screen-root mode, a desktop screenshot (`grim $A/desktop.png` on Wayland) is the strongest evidence that the wallpaper actually rendered.

## Gotchas

- **Destructive to the user's desktop.** Apply in screen-root mode replaces whatever runs on that screen. Stop in window mode and the tray's `Stop Wallpaper` kill every `linux-wallpaperengine` on the machine. Always check `$LWE backends` first.
- A failed spawn (missing backend, a broken wallpaper) shows an inline error under Apply, or the `Backend not installed` dialog. An early exit within about 1 s is reported as failure, which is the behavior under test, not a harness bug.
- `Mute`, `Pause` and `Stop` in the footer are `[disabled]` while nothing is active, so assert them only after Apply.
- The details-panel Apply button's name changes: `Apply`, then `Apply · DP-1` once a screen has been remembered, then the stop label while active. Match with `starts-with` or re-snapshot.
- The tray can't be driven over CDP. Verify the tray only in the desktop target, by asking the user or with a desktop automation tool, and report it as such.
- Cleanup kills backends this run spawned even if you forgot to Stop, but Stop through the UI is part of the proof.
