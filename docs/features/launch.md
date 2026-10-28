# Launching and single instance

Launching the app again reveals and focuses its running window. `--page <name>` and `--page=<name>` select Installed, Workshop, Playlists, Displays, or Settings on a fresh start or in the running instance without reloading the renderer.

## Sub-features

- `launch-page`: a fresh launch opens the requested page.
- `launch-single-instance`: another launch uses the existing process and window.
- `launch-reveal`: relaunch restores minimized windows and reveals windows hidden in the tray.
- `launch-navigation`: a relaunch with a page changes the current route without a reload; missing or invalid pages preserve it.
- `launch-startup-tray`: fresh starts respect minimize-on-startup, while relaunches reveal the window.

## How to get to it (user POV)

- Run `wallpaperx`, or use the desktop launcher or a keybinding running that command.
- Run `wallpaperx --page workshop` (or `installed`, `playlists`, `displays`, `settings`). Other packages accept the same flags on their executable.
- Click the tray icon or `Toggle App` to reveal the same window.

## Driving it with lwe

Preconditions:

- Desktop target; `$LWE launch desktop --page workshop` succeeds and `$LWE doctor` is healthy. Extra arguments after `desktop` pass through to Electron.
- `RUN=$(readlink -f /tmp/lwe-verify/current)` and `A=$RUN/artifacts/launch` are set.
- For a second launch, use the same isolated profile and the already-built entry point, not a second Forge server: `env -u ELECTRON_RUN_AS_NODE XDG_CONFIG_HOME="$RUN/config" DEV_TARGET=desktop node_modules/.bin/electron . <args>`.

- **Fresh page.** `$LWE drive url` ends in `#/workshop`. Capture `$LWE drive screenshot --path "$A/01-fresh-workshop.png"` and `$LWE drive snapshot --path "$A/01-fresh-workshop.aria.txt"`.
- **Second launch.** Run the second-launch command with `--page settings`; `$LWE drive wait --role heading --name Settings --exact` succeeds. Capture the URL, screenshot and ARIA snapshot. Record that the native Electron main PID and window ID stay the same and only one native window exists.
- **Every page.** Repeat with `--page=installed`, `--page=workshop`, `--page=playlists`, `--page=displays`, and `--page=settings`; verify the corresponding hash (`#/` for Installed). Read `$LWE drive eval 'performance.timeOrigin'` before and after; it stays the same.
- **Invalid or absent page.** From Settings, second-launch with no arguments, `--page invalid`, or `--page` alone. `$LWE drive url` remains `#/settings` and the existing window is focused.
- **Close to tray.** On Settings, `$LWE drive click --css 'main button[role="switch"]' --nth 2` enables the tray (this row has a nested label, so `--row` cannot match it). Expand `$LWE drive click --role button --name "Advanced tray options" --exact`, then `$LWE drive click --row "Minimize on close"`. Close the native verification window. Relaunch with `--page workshop`; the same window is visible and focused on Workshop. Capture native state before and after as well as the renderer screenshot.
- **Minimized.** Minimize the native verification window, then relaunch without a page. It restores, becomes visible and focused, and stays on the current page.
- **Startup in tray.** Enable `Minimize on startup` through Settings' advanced tray options, then restart the same isolated profile. Confirm the fresh window is hidden; second-launch with `--page settings` and confirm it becomes visible on Settings. Preserve `$LWE store settings` alongside native before/after state.

## Gotchas

- Chromium can reorder the second instance's argument array on Linux. The primary instance reads validated `additionalData`, rather than parsing that reordered array.
- A lock is scoped to Electron's user-data directory. Never launch verification commands against the user's real profile.
- If the shell sets `ELECTRON_RUN_AS_NODE=1`, unset it when launching Electron directly; Forge already does this.
- The web development target intentionally has no native window. Use `desktop` for these checks.
- Workshop navigation can be verified without Steam, but loading Workshop content requires Steam. Do not report content as verified if Steam is unavailable.
- Native focus and minimize behavior can vary by window manager. Record the compositor used for verification.
