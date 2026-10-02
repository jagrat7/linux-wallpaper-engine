import { defineConfig } from 'vite-plus'
import path from 'path'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/main'),
      '~': path.resolve(import.meta.dirname, './src/main'),
    },
  },
  build: {
    rollupOptions: {
      external: ['steamworks.js'],
    },
  },
})
