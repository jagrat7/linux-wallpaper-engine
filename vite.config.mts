import { defineConfig } from 'vite-plus'
import rendererConfig from './vite.renderer.config.mts'

export default defineConfig({
  ...rendererConfig,
  build: { outDir: '.vite/web' },
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/.git/**', 'tests/browser/**', 'promo/**'],
  },
  resolve: {
    alias: {
      '@': new URL('./src/renderer', import.meta.url).pathname,
      '~': new URL('./src/renderer', import.meta.url).pathname,
    },
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
      'test-results/**',
      'playwright-report/**',
      'node_modules/**',
      'out/**',
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
      'test-results/**',
      'playwright-report/**',
      'node_modules/**',
      'out/**',
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
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
})
