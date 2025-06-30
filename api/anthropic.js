// Vercel serverless function to proxy Anthropic API calls
// This bypasses CORS restrictions by making server-side calls

export default async function handler(req, res) {
  // Enable CORS for our frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages, apiKey, model = 'claude-3-haiku-20240307' } = req.body;

    // Validate required fields
    if (!messages || !apiKey) {
      res.status(400).json({ error: 'Missing required fields: messages and apiKey' });
      return;
    }

    console.log(`📤 Proxying Anthropic API request for model: ${model}`);

    // Make request to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Anthropic API error: ${response.status} - ${errorText}`);
      res.status(response.status).json({ 
        error: `Anthropic API error: ${response.status}`,
        details: errorText
      });
      return;
    }

    const data = await response.json();
    console.log(`✅ Anthropic API success, response length: ${JSON.stringify(data).length}`);
    
    res.status(200).json(data);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}