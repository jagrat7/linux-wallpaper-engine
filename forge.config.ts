import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { packageNativeDeps } from './distro/native-deps'

const { asarUnpackDir, ignore } = packageNativeDeps({
  deps: [
    {
      pkg: 'steamworks.js',
      nativeDir: 'dist/linux64',
      entryFiles: ['index.js', 'package.json'],
    },
  ],
  includedDirs: ['/.vite'],
})

const config: ForgeConfig = {
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'jagrat7',
          name: 'linux-wallpaper-engine',
        },
        prerelease: false,
        draft: false,
        generateReleaseNotes: true,
      },
    },
  ],
  packagerConfig: {
    // Native .node binaries dlopen sibling .so files via RUNPATH=$ORIGIN,
    // so their dir must live on disk instead of inside app.asar.
    asar: { unpackDir: asarUnpackDir },
    icon: './assets/transparent-logo',
    executableName: 'linux-wallpaper-engine',
    extraResource: ['./assets'],
    ignore,
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
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.config.mts',
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
}

export default config
