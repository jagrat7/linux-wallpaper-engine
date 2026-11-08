import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { devBackendPort } from './src/shared/constants/development.ts'

const alias = (directory: string) => ({
  '@': path.resolve(import.meta.dirname, directory),
  '~': path.resolve(import.meta.dirname, directory),
})

// The renderer: the Electron window, the same dev server opened in a browser, and vp check/test.
// scripts/app.mjs builds main and preload with its own configs and uses this one for the renderer.
// https://vitejs.dev/config
export default defineConfig({
  // Relative asset URLs, so the packaged window can load index.html from disk
  base: './',
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: path.resolve(import.meta.dirname, './src/renderer/routes'),
      generatedRouteTree: path.resolve(import.meta.dirname, './src/renderer/routeTree.gen.ts'),
    }),
    react(),
    tailwindcss(),
  ],
  build: { outDir: '.vite/renderer/main_window' },
  server: {
    watch: { ignored: ['**/.vite/**', '**/release/**'] },
    // Browser tabs reach the dev backend in Electron main (src/main/development/gateway.ts)
    proxy: { '/api': { target: `http://127.0.0.1:${devBackendPort(process.env)}`, ws: true } },
  },
  resolve: { alias: alias('./src/renderer') },
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/.git/**', 'promo/**'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    sortTailwindcss: {
      functions: ['clsx', 'cn', 'cva'],
    },
    sortPackageJson: true,
    ignorePatterns: [
      'promo/**',
      'node_modules/**',
      'out/**',
      'release/**',
      'coverage/**',
      'demo-video/**',
      'public/**',
      'pr-video/**',
      '.vite/**',
      '.tanstack/**',
      '.direnv/**',
      '.cache/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.devin/**',
      '.github/ISSUE_TEMPLATE/**',
      'docs/**',
      '.impeccable.md',
      'AGENTS.md',
      '**/*.gen.ts',
      '**/*.d.ts',
      'bun.lock',
      'flake.lock',
    ],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'react'],
    jsPlugins: [
      {
        name: 'local',
        specifier: './dev/oxlint/index.mjs',
      },
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
    },
    ignorePatterns: [
      'promo/**',
      'node_modules/**',
      'out/**',
      'release/**',
      'coverage/**',
      'demo-video/**',
      'public/**',
      'pr-video/**',
      '.vite/**',
      '.tanstack/**',
      '.direnv/**',
      '.cache/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.devin/**',
      '**/*.gen.ts',
      '**/*.d.ts',
    ],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'local/no-server-deep-imports': [
        'error',
        {
          serverDirectory: 'src/main/services',
        },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/no-multi-comp': 'error',
      'react/set-state-in-effect': 'warn',
      'react/incompatible-library': 'warn',
      'react/refs': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-children-prop': 'warn',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: [
          'src/main/services/compatibility.ts',
          'src/main/services/display.ts',
          'src/main/services/invalidation.ts',
          'src/main/services/settings.ts',
          'src/main/services/store.ts',
          'src/main/services/playlists/playlist.ts',
          'src/main/services/system-theme/system-theme.ts',
          'src/main/services/wallpaper/wallpaper.ts',
          'src/main/services/workshop/workshop.ts',
        ],
        rules: {
          'local/only-service-export': 'error',
        },
      },
      {
        files: ['src/renderer/components/ui/**'],
        rules: {
          'react/no-multi-comp': 'off',
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
})
