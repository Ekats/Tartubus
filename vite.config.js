import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to bypass CORS in development
      '/api/digitransit': {
        target: 'https://api.digitransit.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/digitransit/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add the API key header
            const apiKey = process.env.VITE_DIGITRANSIT_API_KEY;
            if (apiKey) {
              proxyReq.setHeader('digitransit-subscription-key', apiKey);
            }
          });
        },
      },
    },
  },
})
