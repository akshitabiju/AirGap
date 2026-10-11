import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Build stamp appended to data requests so the CDN never serves stale JSON after a redeploy.
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('maplibre-gl') ? 'maplibre' : undefined),
      },
    },
  },
})
