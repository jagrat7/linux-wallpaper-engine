import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/main'),
      '~': path.resolve(__dirname, './src/main'),
    },
  },
  build: {
    rollupOptions: {
      external: ['steamworks.js'],
    },
  },
})
