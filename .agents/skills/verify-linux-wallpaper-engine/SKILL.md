---
name: verify-linux-wallpaper-engine
description: Launch and drive the Linux Wallpaper Engine Electron app (React UI over tRPC) in an isolated dev instance, then capture proof that a feature works — ARIA snapshots, screenshots, and the persisted store/config files. Use when asked to verify, test, demo, or screenshot a change to the app UI or behavior (installed library, settings, applying wallpapers, playlists, workshop), or to confirm a fix in the real app rather than unit tests.
---

# Verify Linux Wallpaper Engine

The app is an Electron app: `src/main` (backend services and tRPC routes), `src/renderer` (React, TanStack hash router), `src/preload`. The surface you drive is the renderer UI. Electron main runs the real backend, so it reads your real Steam library and spawns real `linux-wallpaperengine` processes.

Use `dev/verify/lwe` (call it `$LWE` below) to launch, health-check, and clean up the verification instance. It wraps the repo's own dev command (`electron-forge start` with `DEV_TARGET`, which is what `bun dev` / `bun run dev:desktop` run) and drives the UI over CDP with `playwright-core`.

If the CLI provides sufficient evidence that the relevant behavior works, verification is complete. If its controls or observations are insufficient, use direct browser automation against the same instance. Both approaches must meet the Evidence section's requirements: capture the action and result, verify relevant saved state or side effects, and check persistence where applicable.

```bash
LWE=dev/verify/lwe   # from the repo root
```

## Targets

| Target | Command | What runs | Use for |
| --- | --- | --- | --- |
| `web` (default) | `$LWE launch web` | `DEV_TARGET=web`: Electron main with no window plus the dev WS backend on `127.0.0.1:5180`. Headless Chromium opens the printed `Web preview:` URL. | Almost everything. Invisible and needs no window manager. |
| `desktop` | `$LWE launch desktop` | `DEV_TARGET=desktop`: the real Electron window with `--remote-debugging-port`. | Native-only paths: tray, window close/minimize, IPC transport. **It opens a visible window on the user's screen.** |

Both targets render the same renderer code and call the same tRPC router. In the browser target tRPC runs over WebSocket instead of IPC (`src/main/development/gateway.ts`).

## Isolation: what is and isn't sandboxed

- **Isolated:** the electron-store files `settings.json`, `active-wallpapers.json` and `wallpaper-overrides.json`. Launch sets `XDG_CONFIG_HOME=$RUN/config`, so the store lives in `$RUN/config/Linux Wallpaper Engine/` and the user's `~/.config/Linux Wallpaper Engine/` is never touched. Each run starts from default settings.
- **Shared, read-only:** the Steam library (`~/.local/share/Steam/...workshop/content/431960`). The Installed grid shows the user's real wallpapers.
- **Shared and writable: playlists.** They live in Steam's `steamapps/common/wallpaper_engine/config.json`, the same file the user's real app uses. Launch copies it to `$RUN/artifacts/steam-config.before.json`. `$LWE steam-config diff` shows what changed, and cleanup warns if the file differs. Only create playlists named `lwe-verify-<something>` and delete them through the UI before cleanup. `$LWE steam-config restore` exists, but it overwrites the live file. Use it only when this run made the only change.
- **Shared and system-wide: wallpaper processes.** Applying a wallpaper spawns `linux-wallpaperengine` on the real monitor. It first `pkill`s any backend already on that screen, so it takes over the user's real desktop wallpaper. Two stop paths run `pkill -9 -f linux-wallpaperengine` and **kill every backend on the machine**, including ones the user started: any Stop while Settings → `Run in window mode` is on, and the tray's `Stop Wallpaper`. Per-screen Stop with window mode off kills only backends on that screen, but that can still be the user's. Read `docs/features/wallpaper-apply.md` before touching Apply, Stop, Pause, Mute or Random.
- **One web instance at a time.** Port `5180` is hardcoded (`src/shared/constants/development.ts`). If anything else holds it, such as the user's own `bun dev`, launch refuses. Never drive an instance this run didn't start; use `desktop` or ask the user instead. The Vite port and the CDP port are picked automatically.
- The user may have their own instance running from the repo, an Electron process whose cwd is the repo root. Leave it alone; it uses the real config dir.

## Launch

```bash
$LWE setup              # once per checkout: installs playwright-core@1.58.2 into dev/verify/.tools/ (nothing global)
$LWE launch web         # or: $LWE launch desktop
```

Ready means launch printed `ready: run=/tmp/lwe-verify/<run-id> target=... app=http://localhost:5173 cdp=http://127.0.0.1:9333`. Launch waits for forge's `Web preview:` line (web) or `Launched Electron app` (desktop), a CDP page on the app origin, and the sidebar `Installed` button. A cold start takes about 15–40 s. Launch fails fast and prints `logs/dev.log` if the dev process dies.

Prerequisites: `bun install --frozen-lockfile` already done, `bun` and `node` on PATH, and `chromium` or `google-chrome-stable` (override with `LWE_BROWSER=`). The `linux-wallpaperengine` binary is only needed to apply wallpapers.

The current run is the symlink `/tmp/lwe-verify/current`. Set `LWE_RUN=/tmp/lwe-verify/<id>` to address a specific run.

## Doctor

```bash
$LWE doctor
```

Doctor is read-only. It checks the dev and browser process groups are alive, the renderer URL answers, CDP has a page on the app origin, `:5180` is owned by our process group (web), Electron main's `XDG_CONFIG_HOME` is the run's isolated dir, and the renderer has mounted. It also lists `linux-wallpaperengine` processes split into "started by this run" and "existed before launch (never touch)", and prints the git rev the run was built from next to the current HEAD. Run it first, and again whenever anything looks off. If it prints `UNHEALTHY`, run `$LWE cleanup` and relaunch. Don't drive a half-dead instance.

The dev server hot-reloads renderer edits. Main-process edits (`src/main/**`) need a relaunch: cleanup, then launch.

## Drive

`$LWE drive <command> [flags]`: one action per call, attached over CDP. The page state persists between calls.

| Command | Example |
| --- | --- |
| `goto <route>` | `$LWE drive goto /settings`. Routes are hash routes: `/`, `/workshop`, `/playlists`, `/playlists/editor`, `/displays`, `/settings`. |
| `click` / `hover` | `$LWE drive click --role button --name Settings --exact` |
| `fill` | `$LWE drive fill --role textbox --name "Search wallpapers..." --value astronaut` |
| `press` | `$LWE drive press --key Escape` (page-level) or with a locator |
| `wait` | `$LWE drive wait --role heading --name Settings [--state hidden] [--timeout 15000]` |
| `snapshot` | `$LWE drive snapshot [--css main] [--path f.aria.txt]` prints the ARIA tree. Use it to discover handles. |
| `screenshot` | `$LWE drive screenshot --path f.png [--row "Mute audio"] [--full]`. A locator flag scrolls that element into view first. |
| `text` / `attr` / `count` | `$LWE drive attr --row "Mute audio" --attr aria-checked` |
| `eval` | `$LWE drive eval 'document.title'` is for reading state only, never for mutating it. |
| `url` / `reload` | |

Locator flags: `--role R [--name N] [--exact]`, `--label`, `--placeholder`, `--text`, `--css` (also accepts `xpath=...`), `--nth i`, `--within <css>`, `--timeout ms`. There is also **`--row "<label>"`**: Settings and override rows render `<div><span>Label</span>control</div>` with unnamed switches, sliders and comboboxes. `--row "Mute audio"` gets the row's `switch`; add `--role combobox` or `--role slider` for other controls.

Stable handles in this app:
- Sidebar buttons are `Installed`, `Steam Workshop` (its visible text is "Workshop"), `Playlists`, `Displays` and `Settings`. Use `--exact`, because `Settings` also matches other buttons.
- Status bar (`contentinfo`): the text `<screen> No active wallpaper` or the active title, plus the buttons `Pause wallpaper`/`Resume wallpaper`, `Mute`/`Unmute`, `Stop wallpaper`.
- Wallpaper cards are `heading "<title>" [level=3]`. Clicking one opens the details panel, a `complementary` with `heading [level=2]` and the `Apply` split button.
- Unnamed icon buttons show up as bare `button` in snapshots. Reach them by structure (see the feature files), not by coordinates.

## Evidence

Write proof into the run's artifacts dir, one folder per feature: `/tmp/lwe-verify/current/artifacts/<feature-id>/`. **Resolve the real path first** (`readlink -f /tmp/lwe-verify/current`) and record it. Cleanup removes the `current` symlink, but the run dir and its `artifacts/` and `logs/` stay.

Proof standards:
- Drive the real user path: sidebar, buttons, the keyboard. Don't call tRPC directly, and don't set store files by hand to fake state.
- Capture the action and the result. Take an ARIA snapshot or screenshot before, do the action, then capture after. A screenshot of the final screen alone isn't proof.
- Verify side effects as well as the UI:
  - Settings and overrides: `$LWE store settings`, `$LWE store wallpaper-overrides`, `$LWE store active-wallpapers` (the isolated JSON).
  - Playlists: `$LWE steam-config diff`.
  - Wallpaper processes: `$LWE backends`, or `pgrep -af linux-wallpaperengine` for the exact argv (`--screen-root`, `--bg <id>`, `--window`, `--silent`).
- Prove persistence with a second view: `$LWE drive reload` or navigate away and back, then re-read the value.
- `logs/dev.log` has main-process output. Copy relevant lines into the artifact folder if they are part of the proof.
- No mocks. The only isolation is the config dir. Workshop needs network and a running, logged-in Steam. If it's unavailable, report the path as unverified rather than proving it some other way.
- Report each feature ID, the entry point you used, and the artifact paths. A sub-feature you skipped is reported as skipped, not as verified through a different path.

## Cleanup

```bash
$LWE cleanup
```

Cleanup kills `linux-wallpaperengine` processes this run spawned: children of our Electron, plus pids recorded during the run. It never touches backends listed as pre-existing. It then TERMs (and after 10 s KILLs) the browser and dev process groups this run created, deletes `$RUN/config` and `$RUN/chrome`, and removes the `current` symlink. It keeps `$RUN/artifacts/` and `$RUN/logs/`, and warns if the Steam playlists file changed or ports are still bound. Never kill by process name: the user's own Electron instance and wallpapers share the names.

Run cleanup after every failed attempt too, then relaunch. Confirm afterwards that `ls <run dir>/artifacts` still shows your proof.

## Feature map

`docs/features/README.md` indexes one recipe per user-facing feature: preconditions, every entry point, exact drive commands, the observable end state, and gotchas. Read the matching file before driving. A proof that covers one entry point while the map lists others is incomplete. Keep the map current with `/maintain-verification-skill`.
