// Proxy service to handle API calls through a backend
export class ProxyService {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async callAI(provider: 'openai' | 'anthropic', apiKey: string, model: string, prompt: string) {
    const response = await fetch(`${this.baseUrl}/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        apiKey,
        model,
        prompt
      })
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status}`);
    }

    return await response.json();
  }

  async testAPIKey(provider: 'openai' | 'anthropic', apiKey: string, model: string) {
    try {
      const response = await fetch(`${this.baseUrl}/test-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
          model
        })
      });

      return response.ok;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }
}

export const proxyService = new ProxyService();