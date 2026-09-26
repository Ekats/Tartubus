import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Generate a build hash based on current timestamp
const BUILD_HASH = Date.now().toString(36);

// Stamp the build hash into the copied service worker so every deploy ships a
// byte-different worker (browsers only install a new worker when its bytes change)
function stampServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'service-worker.js');
      if (!fs.existsSync(swPath)) return;
      const source = fs.readFileSync(swPath, 'utf8');
      if (!source.includes('__BUILD_HASH__')) {
        throw new Error('service-worker.js has no __BUILD_HASH__ placeholder to stamp');
      }
      fs.writeFileSync(swPath, source.replaceAll('__BUILD_HASH__', BUILD_HASH));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  base: './', // Use relative paths for Capacitor compatibility
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'happy-dom',
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
