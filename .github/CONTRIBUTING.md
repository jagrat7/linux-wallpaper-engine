# Contributing

Thanks for your interest in contributing! For bug reports and feature requests, please use the [issue templates](https://github.com/jagrat7/linux-wallpaper-engine/issues/new/choose). This guide is for code contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [Submitting Changes](#submitting-changes)
- [Becoming a Collaborator](#becoming-a-collaborator)

## Getting Started

### Prerequisites

- Node `^22.18.0 || ^24.11.0 || >=26` and [Bun](https://bun.sh/) - you'll need both for development
- [linux-wallpaperengine](https://github.com/Almamu/linux-wallpaperengine) installed and binary accessible in your `$PATH`
- [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/) installed on Steam with wallpapers downloaded

For Nix, refer to the [devshell](#nix-devshell) section.

### Development Setup

```bash
git clone https://github.com/jagrat7/linux-wallpaper-engine.git
cd linux-wallpaper-engine
```

Then, on any distro, proceed to:

```bash
bun install --frozen-lockfile
bun dev
```

`bun dev` starts the web preview only: the backend runs in Electron without a window, and the app opens in a browser at the printed `Web preview:` URL. The project uses [Vite+](https://viteplus.dev), so each script also runs through the `vp` CLI (installed locally, so `bunx vp ...` works without a global install):

| bun                                 | Vite+                       | Does                           |
| ----------------------------------- | --------------------------- | ------------------------------ |
| `bun dev`                           | `vp run dev`                | Web preview only               |
| `bun run dev:desktop` / `bun ddev`  | `vp run dev:desktop`        | Desktop window only            |
| `bun run dev:full` / `bun fdev`     | `vp run dev:full`           | Web preview and desktop window |
| `bun run make`                      | `vp run make`               | Build release packages         |
| `bun run check`                     | `vp run check`              | Lint and type check            |
| `bun run lint` / `bun run lint:fix` | `vp lint` / `vp lint --fix` | Lint                           |
| `bun run fmt` / `bun run fmt:check` | `vp fmt` / `vp fmt --check` | Format                         |
| `bun run test` / `bun run test:w`   | `vp test` / `vp test watch` | Test                           |

Native features that need a window, such as the tray, only run with `dev:desktop` or `dev:full`. Every dev script runs `scripts/app.mjs dev`: it serves the renderer with Vite, rebuilds main and preload on save, and restarts Electron when main-process code changes (type `rs` to restart by hand). `vp check` runs format, lint and type checks in one pass. Use `vp run dev`, not `vp dev`: `vp dev` is Vite's own dev server without Electron.

### Building Packages

```bash
bun run make
```

Builds the deb, rpm, zip and AppImage with [electron-builder](https://www.electron.build/) into `release/`. Packaging is configured in `electron-builder.yml`; `bun run package` builds only the unpacked app (`release/linux-unpacked/`). Building the .rpm needs `rpmbuild` installed.

Releases are built and tested in CI, not on a laptop. The `Distro tests` workflow installs and launches each package on Debian, Fedora and Arch (the AUR PKGBUILD) and runs the AppImage; run one locally with `bash scripts/ci/distro-smoke.sh <debian|fedora|arch|appimage> release <output dir>` (needs Docker and `dev/verify/lwe setup`).

### Releasing

Releases are built, tested and published by the `Release` workflow (`.github/workflows/release.yml`):

```bash
# 1. Bump "version" in package.json, commit, and merge to main
# 2. Tag that commit and push the tag
git tag v0.5.0 && git push origin v0.5.0
```

The tag must match `package.json`. CI then runs the type check and tests, builds every package, installs and launches each one on its distro (`Distro tests`), creates the GitHub release with generated notes, and publishes the AUR package (that last job waits for approval in the `aur` environment). If a release fails partway, run `Release` from the Actions tab with the same tag: it uploads only the files the release is missing and never replaces published ones, so their checksums and the AUR package stay valid. Tags from before this workflow (v0.4.12 and earlier) don't match `package.json` and can't be rerun.

### Nix Devshell

As with the installation setup, flakes must be enabled. With [nix-direnv](https://github.com/nix-community/nix-direnv), it's as simple as getting in to the project root and allowing it.

```bash
cd linux-wallpaper-engine
direnv allow
```

Now, every time you cd into the repo, you should be in the devshell with all the necessary dependencies and packaging set up. If not using direnv, you can access the devshell with:

```bash
nix develop

# you can also pass commands without entering the devshell
nix develop -c bun dev
```

In the devshell, `bun run make` packages the app; the .rpm also needs `rpmbuild`, which the devshell doesn't provide. To build specifically for Nix, you'll have to build the flake output package:

```bash
# nix build, but with prettier output
nom build

# run the binary
./result/bin/linux-wallpaper-engine
```

> NOTE: For non-NixOS systems, there's currently a limitation when it comes to graphics drivers for Electron.

## Project Structure

The app follows a 3-layer Electron architecture:

```text
src/
├── main/                  # Electron main process (backend)
│   ├── services/          # Business logic (singleton pattern)
│   │   └── <name>/        # Bigger services: <name>.ts, .interface.ts, .types.ts, .utils.ts, tests
│   ├── trpc/routes/       # tRPC API endpoints
│   ├── utils/             # Main-process helpers (tray, autostart, launch, version)
│   └── development/       # Dev-only gateway that serves tRPC and media to a browser tab
├── renderer/              # React UI (frontend)
│   ├── components/        # UI components by feature (+ shadcn/ui in components/ui/)
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React context providers (+ Jotai atoms in contexts/atoms/)
│   ├── routes/            # TanStack Router pages (routeTree.gen.ts is generated)
│   ├── design/            # Dev-only /design page (+ component demos in design/demos/)
│   ├── styles/            # global.css: Tailwind theme tokens
│   └── lib/               # Utilities (cn, tRPC client, platform)
├── preload/               # IPC bridge
└── shared/
    ├── constants/         # Types & constants shared across layers
    └── utils/             # Pure helpers shared across layers

dev/                       # Dev tooling: custom Oxlint rules, app verification driver
scripts/                   # Dev runner (app.mjs), CI package tests, design preset, tray icons
distro/                    # Packaging for AUR and Nix
docs/                      # Screenshots and feature docs (docs/features/)
assets/                    # App icons, favicons and tray icons

electron-builder.yml       # Packaging: deb, rpm, zip, AppImage
scripts/app.mjs            # Builds main, preload and renderer with Vite; runs `bun dev`
vite.config.mts            # Vite+ config: the renderer build, plus lint, fmt and test
components.json            # shadcn/ui config
flake.nix                  # Nix package and devshell
```

Each build (`scripts/app.mjs` for main and preload, `vite.config.mts` for the renderer) has `@` and `~` aliases pointing to its respective `src/` subdirectory.

The renderer communicates with the main process through tRPC — IPC in the Electron window, plus a development-only WebSocket bridge so the renderer URL from `bun dev` and `bun run dev:full` also works in a browser tab. This gives full type safety across process boundaries. You can check out my [react-electron-template](https://github.com/jagrat7/react-electron-template) for details on how I setup the app.

TLDR: UI React stuff is in `renderer/` and the "backend" logic is in `main/`.

## Development Guide

Make your best effort to keep it DRY and organized. Before writing new code, check if something reusable already exists. If you feel this is not most optimial way to do things, do let me know. Here's where things go:

### Shared

- **Constants** — `src/shared/constants/`
- **Types** — Don't redefine a shared type. Look in `src/shared/constants/` first; it probably already exists
- **Import aliases** — Use `@` or `~` import aliases instead of relative paths (e.g. `import { cn } from '@/lib/utils'`)

### "Backend" (`src/main/`)

- **Services** — `src/main/services/`, follow the singleton pattern. Keep complex logic here, not in the API layer. Big services should be split into smaller, focused services and utilities
- **Service docs** — Add JSDoc to service functions and methods
- **Service files** — Don't litter a service folder with one-off files. Try adding the code to the service's utils file first
- **Service interfaces** — Keep them small, like the APIs of tRPC, React Query or Zod: a few verbs that take a typed input, not one method per case. Adding a member to a service interface is heavily discouraged, so first see whether the behavior fits an existing one:
  - One action with a discriminated input (`apply({ kind: 'random' })`) instead of `applyRandom`, `applyPlaylist`, ...
  - One read that returns a snapshot (`getActive()`) instead of a getter per field (`getActiveScreens`, `getPausedScreens`, ...)
  - Pure helpers that need no service state go in utils, not on the service
- **Service imports** — A nested service's public file matches its folder name (singular for a plural folder), such as `../../services/wallpaper/wallpaper` or `../../services/playlists/playlist`. Call the service API from outside its folder. Oxlint rejects imports into other files in a service folder from outside it.
- **tRPC routes** — `src/main/trpc/routes/`, this layer is for assembling service calls and returning data. Low-complexity logic (e.g. `window.ts`) can live here directly, but anything more complex should go in a service. You should always validate tRPC input with Zod

### "Frontend" (`src/renderer/`)

- **Hooks** — `src/renderer/hooks/`, create reusable hooks for UI logic
- **Utility functions** — `src/renderer/lib/utils.ts` (e.g. `cn()` for classnames, date formatting)
- **UI components** — use existing shadcn/ui components in `components/ui/` or install new ones via shadcn CLI for React
- **Design page** — `/design` (dev only, `#/design` in `bun dev`) shows the design system: the tokens from `src/renderer/styles/global.css` and a demo of every UI component. A new file in `src/renderer/components/ui/` needs a `src/renderer/design/demos/<name>.demo.tsx`, written from the component's own variants; the page lists any component without one. Rerun `bun scripts/design-preset.ts` after changing `components.json`
- **Styling** — use Tailwind CSS

### Configuration (`electron-builder.yml`, `scripts/app.mjs`, `vite.config.mts`)

- **electron-builder config** — controls packaging: targets, package dependencies, what goes into `app.asar`. Changes here affect how the app is built and distributed, so the `Distro tests` workflow runs on them
- **Vite builds** — `scripts/app.mjs` holds the main and preload configs; `vite.config.mts` is the renderer's, with the React, TanStack Router, and Tailwind plugins

### Code Rules

- No semicolons in files
- Avoid hardcoded values — extract to `src/shared/constants/`
- No hardcoded colors like `text-red-500` — use Tailwind theme variables from `global.css`
- Use kebab-case for file and folder names
- Group related components in their own folder
- Run `bun run check` before submitting. Use `bun run fmt` to format changes and `bun run fmt:check` to check formatting.

## Submitting Changes

### Fork + PR (recommended)

1. Fork the repo on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/your-username/linux-wallpaper-engine.git
   cd linux-wallpaper-engine
   ```

3. Create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

4. Push to your fork and open a pull request against `main`
5. Fill in the PR template: why the change is needed, what changed, and evidence that it works. Link any related issues (e.g. "Addresses #12")

### Branch Naming

| Prefix      | Use for               |
| ----------- | --------------------- |
| `feat/`     | New features          |
| `fix/`      | Bug fixes             |
| `docs/`     | Documentation changes |
| `refactor/` | Code refactoring      |
| `misc/`     | Miscellaneous changes |

## Becoming a Collaborator

If you're a regular contributor and/or want direct push access (no forking needed), reach out via:

- A [GitHub Issue](https://github.com/jagrat7/linux-wallpaper-engine/issues) or [Discussion](https://github.com/jagrat7/linux-wallpaper-engine/discussions)
- Socials linked on my [Profile](https://github.com/jagrat7)
