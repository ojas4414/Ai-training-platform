import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('recharts')) {
            return 'charts-vendor';
          }

          if (id.includes('react')) {
            return 'react-vendor';
          }

          if (id.includes('axios')) {
            return 'http-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/cache': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/train': 'http://localhost:8000',
      '/hpo': 'http://localhost:8000',
      '/experiments': 'http://localhost:8000',
      '/models': 'http://localhost:8000',
      '/predict': 'http://localhost:8000',
      '/analyse': 'http://localhost:8000',
      '/export': 'http://localhost:8000',
    },
  },
})
