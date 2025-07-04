// Environment variable helpers
export const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'claude';
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
export const CLAUDE_PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001/claude';

// Validation helpers - now checks proxy availability instead of API key
export const hasValidApiKey = (): boolean => {
  // Since we're using proxy, we just check if the proxy URL is configured
  return !!CLAUDE_PROXY_URL;
};

export const getEnvStatus = () => {
  return {
    hasApiKey: hasValidApiKey(),
    provider: AI_PROVIDER,
    devMode: DEV_MODE,
    proxyUrl: CLAUDE_PROXY_URL,
  };
};