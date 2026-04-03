import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
  },
  server: {
    // Forward /api requests to the Express backend so the Vite dev server
    // and the backend can run on different ports without CORS issues.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
