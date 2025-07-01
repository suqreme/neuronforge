import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Cross-origin isolation REMOVED to fix CSP blocking JavaScript execution
    // This allows Tailwind CDN, eval(), and normal agent→sandbox file transfer
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