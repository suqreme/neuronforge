import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true, // Listen on all addresses
    },
    define: {
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'import.meta.env.VITE_AI_PROVIDER': JSON.stringify(env.VITE_AI_PROVIDER),
      'import.meta.env.VITE_DEV_MODE': JSON.stringify(env.VITE_DEV_MODE),
      'import.meta.env.VITE_CLAUDE_PROXY_URL': JSON.stringify(env.VITE_CLAUDE_PROXY_URL),
    },
  };
})