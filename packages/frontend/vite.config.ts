import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/tenants':    { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/executive':  { target: 'http://localhost:3002', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/concessions':{ target: 'http://localhost:3003', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/security':   { target: 'http://localhost:3009', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/parking':    { target: 'http://localhost:3010', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/nlq':        { target: 'http://localhost:3012', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
      '/api/agents':     { target: 'http://localhost:3014', changeOrigin: true, rewrite: (p) => p.replace('/api', '') },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts', 'd3'],
          maps:   ['mapbox-gl', 'react-map-gl'],
          query:  ['@tanstack/react-query'],
          clerk:  ['@clerk/clerk-react'],
        },
      },
    },
  },
});
