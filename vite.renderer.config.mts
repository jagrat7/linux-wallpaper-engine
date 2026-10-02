import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config
export default defineConfig({
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
  server: {
    watch: {
      ignored: [
        '**/.dev-runtime/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/.vite/**',
        '**/out/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/renderer'),
      '~': path.resolve(import.meta.dirname, './src/renderer'),
    },
  },
})
