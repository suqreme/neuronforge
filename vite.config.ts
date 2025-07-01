import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crossOriginIsolation()
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174
    }
  },
  optimizeDeps: {
    include: ['@xyflow/react', '@webcontainer/api']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'flow-vendor': ['@xyflow/react'],
          'webcontainer-vendor': ['@webcontainer/api']
        }
      }
    }
  }
})