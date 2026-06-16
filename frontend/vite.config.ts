import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to FastAPI backend in development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
          if (id.includes('react-router')) return 'router';
          if (id.includes('recharts')) return 'charts';
        },
      },
    },
  },
})
