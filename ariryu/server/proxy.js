import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for file content

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'claude-proxy', timestamp: new Date().toISOString() });
});

// Claude API proxy endpoint
app.post('/claude', async (req, res) => {
  try {
    console.log('Proxying Claude request:', {
      model: req.body.model,
      messagesCount: req.body.messages?.length,
      maxTokens: req.body.max_tokens
    });

    if (!process.env.CLAUDE_API_KEY) {
      console.error('CLAUDE_API_KEY not found in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        detail: 'Claude API key not configured' 
      });
    }

    const response = await axios.post(CLAUDE_API, req.body, {
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 60000, // 60 second timeout
    });

    console.log('Claude response:', {
      status: response.status,
      model: response.data.model,
      usage: response.data.usage
    });

    res.json(response.data);
  } catch (err) {
    console.error('Claude Proxy Error:', {
      message: err.message,
      status: err?.response?.status,
      data: err?.response?.data
    });

    const status = err?.response?.status || 500;
    const errorDetail = err?.response?.data || err.message;
    
    res.status(status).json({ 
      error: 'Claude API failed', 
      detail: errorDetail,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    detail: err.message,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Claude proxy server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Claude endpoint: http://localhost:${PORT}/claude`);
  console.log(`🔑 API Key configured: ${!!process.env.CLAUDE_API_KEY}`);
});