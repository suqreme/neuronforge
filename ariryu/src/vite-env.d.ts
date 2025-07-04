/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_AI_PROVIDER: string
  readonly VITE_DEV_MODE: string
  readonly VITE_CLAUDE_PROXY_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}