import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Tartubus/', // GitHub Pages will serve from https://ekats.github.io/Tartubus/
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      // Proxy API requests to bypass CORS in development
      '/api/digitransit': {
        target: 'https://api.digitransit.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/digitransit/, ''),
        timeout: 30000, // 30 second timeout
        proxyTimeout: 30000,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add the API key header
            const apiKey = process.env.VITE_DIGITRANSIT_API_KEY;
            if (apiKey) {
              proxyReq.setHeader('digitransit-subscription-key', apiKey);
            }
          });

          // Log proxy errors for debugging
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err);
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Log slow responses
            const startTime = Date.now();
            proxyRes.on('end', () => {
              const duration = Date.now() - startTime;
              if (duration > 5000) {
                console.warn(`Slow API response: ${duration}ms for ${req.url}`);
              }
            });
          });
        },
      },
    },
  },
})
