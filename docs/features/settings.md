# Settings

The Settings page holds the global preferences that apply to every wallpaper (performance, audio, display, appearance) and the app's own behavior (tray, startup, debug, window mode). Every change saves to the store immediately and survives a restart. `Reset to Defaults` restores everything.

## Sub-features

- `settings-toggle`: switches such as `Pause on fullscreen apps`, `Mute audio`, `Disable mouse interaction` and `Show status bar` save at once.
- `settings-select`: comboboxes such as `Maximum FPS`, `Default scaling` and `Theme` save at once.
- `settings-slider`: the `Volume` slider saves.
- `settings-grid-size`: the `Grid size` radiogroup (`Compact`/`Medium`/`Large`) changes the Installed grid density.
- `settings-reset`: `Reset to Defaults` (no confirmation) restores `DEFAULT_SETTINGS` (`src/shared/constants/app.ts`).
- `settings-persist`: values survive a reload and a relaunch of the main process.
- `settings-mute-statusbar`: the status bar's `Mute`/`Unmute` button flips the same `silent` setting.

## How to get to it (user POV)

- Sidebar `Settings` (`/settings`).
- The scan reminder banner's `Go to Settings` link.
- The status bar `Mute` button, for `silent` only.

## Driving it with lwe

Preconditions:

- `$LWE doctor` is healthy. This is a fresh run, so `$LWE store settings` shows `DEFAULT_SETTINGS`, which the store writes at startup.
- `A=$(readlink -f /tmp/lwe-verify/current)/artifacts/settings` is set.

- **Open.** Choose Settings. Run `$LWE drive click --role button --name Settings --exact`, then `$LWE drive wait --role heading --name Settings --exact`. Sections `General`, `Compatibility`, `Audio`, `Display` and `Appearance` are visible.
- **Before state.** Run `$LWE drive attr --row "Mute audio" --attr aria-checked`, which prints `false`. Then run `$LWE store settings | jq .silent`, which prints `false`. Capture `$LWE drive screenshot --row "Mute audio" --path $A/01-before.png`.
- **Toggle.** Flip `Mute audio`. Run `$LWE drive click --row "Mute audio"`. `$LWE drive attr --row "Mute audio" --attr aria-checked` prints `true`, and after about 1 s `$LWE store settings | jq .silent` prints `true`.
- **Persist.** Reload and re-read. Run `$LWE drive reload`, `$LWE drive wait --role heading --name Settings --exact`, then `$LWE drive attr --row "Mute audio" --attr aria-checked`, which still prints `true`. Capture `$LWE drive snapshot --css main --path $A/02-after-reload.aria.txt`, `$LWE drive screenshot --row "Mute audio" --path $A/02-after-reload.png` and `$LWE store settings > $A/03-settings.json`.
- **Select.** Change the theme. Run `$LWE drive click --row Theme --role combobox`; the listbox options are `Light`, `Dark`, `Steam`, `System` and `Hard Light`. Then run `$LWE drive click --role option --name Dark`. The combobox reads `Dark`, `$LWE store settings | jq .theme` prints `"dark"`, and the page renders dark. To screenshot it, run `$LWE drive screenshot --row Theme --role combobox --path $A/04-theme-dark.png`. `--row` defaults to the `switch` role, so pass `--role` for other controls.
- **Grid size.** Run `$LWE drive click --role radio --name Compact`. `$LWE store settings | jq .wallpaperGridDensity` changes, and Installed shows more columns.
- **Status bar mute.** The footer `Mute`/`Unmute` button is disabled while no wallpaper is active, so drive it only after an Apply (see `wallpaper-apply.md`). Run `$LWE drive click --role button --name Mute --exact --within footer`. The button becomes `Unmute`, and the `Mute audio` row and `jq .silent` both flip. If you didn't apply a wallpaper, report `settings-mute-statusbar` as skipped.
- **Reset.** Choose `Reset to Defaults`. Run `$LWE drive click --role button --name "Reset to Defaults"`. It applies immediately with no confirmation dialog. `Mute audio` returns to unchecked, and `$LWE store settings | jq '{silent,theme,wallpaperGridDensity}'` prints `false`, `"system"`, `"medium"`. Capture `$LWE drive snapshot --css main --path $A/05-after-reset.aria.txt` and `$LWE store settings > $A/05-after-reset.settings.json`.

## Gotchas

- Settings switches have **no accessible name**. `--role switch --name "Mute audio"` matches nothing, so use `--row "Mute audio"`. Row labels are the exact visible text, including `Don't mute when other apps play audio` with its apostrophe.
- `Launch on startup` writes `~/.config/autostart/<name>.desktop` in the **real** home (it uses `app.getPath('home')`, not XDG). Don't toggle it unless that is the feature under test, and turn it back off before cleanup.
- `Enable system tray`, minimize-on-close and the tray menu only exist in the desktop target. In the web target they save but have no visible effect.
- `Scan` in Compatibility launches `linux-wallpaperengine` once per wallpaper. That is slow and puts windows on the screen. Treat it as its own heavy feature, not a settings smoke test.
- `Run in window mode` changes how Apply and Stop behave. With it on, any Stop kills every backend on the machine. See `wallpaper-apply.md`.
- The theme default `System` follows the desktop (Omarchy/Hyprland/KDE/COSMIC) palette, so screenshots vary between machines.
