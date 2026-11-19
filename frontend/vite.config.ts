import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Glass style's optional backdrop photo (glass.css explains it). Looked
// for at build time, so a board without one never requests a missing file;
// start.py rebuilds whenever public/ changes.
const glassBackdrop = existsSync(fileURLToPath(new URL('./public/glass-backdrop.jpg', import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __GLASS_BACKDROP__: JSON.stringify(glassBackdrop),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
