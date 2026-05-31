# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single-package **Electron 39 + React 19** desktop app for managing Steam Wallpaper Engine wallpapers on Linux. No monorepo, no HTTP API — renderer talks to main via **tRPC over Electron IPC**. External runtime deps (not in this repo): `linux-wallpaperengine` CLI, Steam + Wallpaper Engine assets.

### Commands (see `package.json` and `.github/CONTRIBUTING.md`)

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Dev app | `bun dev` (`electron-forge start`; Vite renderer ~5173) |
| Lint + types | `bun run check` |
| Unit tests | `bun run test` (Vitest) — **not** `bun test` (Bun’s runner lacks Vitest APIs) |
| Package | `bun run make` → `out/` |

Requires **Bun** and **Node.js** on PATH. Postinstall runs `bun2nix` for Nix lockfiles.

### Cloud VM / display

- Graphical session uses **`DISPLAY=:1`** (X11). Set it when starting `bun dev`.
- Harmless **DBus parse errors** in headless/VNC environments; app can still run.
- If GPU init fails (`viz_main_impl` / GPU process exit), retry with `ELECTRON_DISABLE_GPU=1`.
- Keep long-running dev in **tmux** (e.g. session `electron-dev`), not a one-shot background shell.

### Optional vs required for dev

| Dependency | UI / navigation | Apply wallpapers / scanner / playlists |
|------------|-----------------|----------------------------------------|
| `bun dev` + display | Required | Required |
| `linux-wallpaperengine` on PATH | Optional (shows missing-backend UI) | Required |
| Steam + WE workshop folders | Optional (empty gallery OK) | Required for real content |

Nix users: `nix develop` or `direnv allow` pulls `linux-wallpaperengine`, Electron override, and tooling from `flake.nix` / `distro/nix/shell.nix`.

### Tests note

`bun run test` may have some pre-existing failures in `settings.test.ts` and `wallpaper.test.ts` (Electron mock / compatibility mock). `wallpaper.utils.test.ts` and `display.test.ts` are the stable suites. CI in this repo does not run Vitest on every push — still run `bun run check` before changes.
