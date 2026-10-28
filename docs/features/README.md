# Linux Wallpaper Engine verification map

This directory is the maintained source for verifying what users can do in Linux Wallpaper Engine. Read the index before driving the app, then follow the matching feature file as the recipe. Harness commands come from `.agents/skills/verify-linux-wallpaper-engine/SKILL.md` (`$LWE` = `dev/verify/lwe`).

## Baseline preconditions

- `$LWE launch web` succeeded (or `desktop` when the feature file says it needs a native window), and `$LWE doctor` prints `healthy`.
- Each run starts with default settings in an isolated store: `XDG_CONFIG_HOME=/tmp/lwe-verify/<run>/config`.
- The Installed library is the user's real Steam Wallpaper Engine library. Don't hardcode a title from one machine as a precondition. Pick one from `$LWE drive snapshot --css main`, such as the first `heading [level=3]`, and record which one you used.
- Playlists come from the user's real Steam `wallpaper_engine/config.json`. Create only playlists named `lwe-verify-<run-id>`.
- `$LWE backends` must show `existed before launch: 0` before any recipe applies or stops a wallpaper. Otherwise ask the user first: those actions kill backends on the same screen.
- Never drive an instance this run did not launch.

## Driving conventions

- Start every recipe from `$LWE drive goto <route>` unless it says otherwise.
- Prefer ARIA roles and accessible names (`--role button --name "Apply"`), then `--row "<setting label>"` for settings rows, then the structural XPaths given in the feature files. Never use coordinates.
- Use `--exact` for short names that are also substrings, such as `Settings`, `Name` and `Apply`.
- Wait for the observable result (`$LWE drive wait ...`) instead of sleeping. A 1 s pause is acceptable only after a store write when you then read the JSON file.
- Restore what you mutated: delete `lwe-verify-*` playlists, stop wallpapers you applied. Don't remove proof artifacts.

## Proof and skip reporting

- Save artifacts to `<run dir>/artifacts/<feature-id>/`, using the resolved path from `readlink -f /tmp/lwe-verify/current`.
- UI proof is an ARIA snapshot (`.aria.txt`) plus a screenshot, taken before and after the action.
- Mutation proof also needs a second view: reload or navigate away and back, plus the backing file. That is `$LWE store <name>` for settings, overrides and active wallpapers, `$LWE steam-config diff` for playlists, and `pgrep -af linux-wallpaperengine` for processes.
- Record the feature ID and entry point with every artifact.
- Report an unreachable path, such as Workshop without Steam, with the command you tried and the precondition that wasn't met. Don't report a skipped entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the behavior the user sees. It then has exactly four H2 sections, in this order:

1. `Sub-features`: short IDs, one line per behavior.
2. `How to get to it (user POV)`: every entry point a user has.
3. `Driving it with lwe`: starts with `Preconditions:`, then labeled bullets that pair each user action with an exact command and the observable result.
4. `Gotchas`: traps that can waste or invalidate a run.

## Features

- [Launching](./launch.md): one instance, page arguments, and revealing hidden or minimized windows. Requires the desktop target.
- [Installed library](./installed-library.md): browse, search, filter, sort and open the details panel for local wallpapers.
- [Settings](./settings.md): global preferences that persist to the store, plus reset to defaults.
- [Apply wallpaper](./wallpaper-apply.md): apply, stop, pause, mute and per-wallpaper overrides, from the details panel, the status bar and Displays. Spawns real backend processes.
- [Playlists](./playlists.md): create, apply, edit and delete wallpaper rotations stored in Steam's `config.json`.
- [Workshop](./workshop.md): discover, browse and search Steam Workshop wallpapers. Needs network and Steam.
