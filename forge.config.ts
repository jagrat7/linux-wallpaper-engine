import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { MakerFlatpak } from '@electron-forge/maker-flatpak'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

const config: ForgeConfig = {
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'jagrat7',
          name: 'linux-wallpaper-engine'
        },
        prerelease: false,
        draft: false,
        generateReleaseNotes: true,
      }
    }
  ],
  packagerConfig: {
    asar: true,
    icon: './assets/transparent-logo',
    executableName: 'linux-wallpaper-engine',
    extraResource: ["./assets"],
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['linux']),
    new MakerDeb({
      options: {
        icon: './assets/transparent-logo.png',
      },
    }),
    new MakerRpm({
      options: {
        icon: './assets/transparent-logo.png',
      },
    }),
    new MakerFlatpak({
      options: {
        id: 'com.github.jagrat7.LinuxWallpaperEngine',
        // Default handling of icons are broken for flatpak
        // Need to explicitly pass a set of size values
        // and ignore the typing for this one lol
        icon: {
          '512x512': './assets/transparent-logo.png'
        } as any,
        categories: ['Utility'],
        runtimeVersion: '24.08',
        base: 'org.electronjs.Electron2.BaseApp',
        baseVersion: '24.08',
        finishArgs: [
          // X11 + Wayland rendering
          '--socket=x11',
          '--socket=wayland',
          '--share=ipc',
          // GPU access
          '--device=dri',
          // Audio
          '--socket=pulseaudio',
          // Home directory access (read wallpapers + write config)
          '--filesystem=home',
          // Chromium singleton check socket
          '--env=TMPDIR=/var/tmp',
          // Network access
          '--share=network',
          // Access to linux-wallpaperengine binary on host
          '--talk-name=org.freedesktop.Flatpak',
          // System notifications / tray
          '--talk-name=org.freedesktop.Notifications',
          '--talk-name=org.kde.StatusNotifierWatcher',
        ],
        files: [],
        // BaseApp already includes zypak; skip the default module
        // that tries to compile it from source (requires clang++)
        modules: [],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
