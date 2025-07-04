import type { LLMProvider } from './claudeApi';

// Global provider state (in a real app, this would be in a store)
let currentProvider: LLMProvider = (import.meta.env.VITE_AI_PROVIDER as LLMProvider) || 'claude';

export function getCurrentProvider(): LLMProvider {
  return currentProvider;
}

export function setCurrentProvider(provider: LLMProvider): void {
  currentProvider = provider;
  console.log(`🔄 LLM Provider switched to: ${provider.toUpperCase()}`);
}

export function getAvailableProviders(): { provider: LLMProvider; available: boolean; name: string }[] {
  const claudeProxyUrl = import.meta.env.VITE_CLAUDE_PROXY_URL;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  return [
    {
      provider: 'claude',
      available: !!claudeProxyUrl, // Claude now works via proxy
      name: 'Claude 3.5 Sonnet (Proxy)'
    },
    {
      provider: 'openai',
      available: !!(openaiKey && openaiKey !== 'your_openai_api_key_here'),
      name: 'GPT-4'
    }
  ];
}