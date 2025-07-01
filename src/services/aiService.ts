import { APIKey } from '../stores/apiKeysStore';

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface AIGenerationRequest {
  type: 'ui' | 'backend';
  taskDescription: string;
  appName: string;
  framework?: string;
  additionalContext?: string;
  existingFiles?: string[];
}

export interface AIGenerationResponse {
  files: GeneratedFile[];
  reasoning: string;
  suggestions: string[];
}

class AIService {
  private async callOpenAI(apiKey: APIKey, prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: apiKey.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software developer. Generate clean, production-ready code based on the requirements. Always respond with valid JSON containing the file structure and code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callAnthropic(apiKey: APIKey, prompt: string): Promise<string> {
    // TODO: In production, this should go through a backend proxy
    // For now, we'll use a fallback or throw an informative error
    
    try {
      // Use our proxy API to bypass CORS
      const proxyUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/anthropic'  // Local development proxy
        : '/api/anthropic';  // Production Vercel function
        
      console.log(`🔗 Using AI proxy: ${proxyUrl} (hostname: ${window.location.hostname})`);
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey.key,
          model: apiKey.model,
          messages: [
            {
              role: 'user',
              content: `You are an expert software developer. Generate clean, production-ready code based on the requirements. Always respond with valid JSON containing the file structure and code.\n\n${prompt}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content[0]?.text || '';
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('CORS error detected, falling back to template generation');
        throw new Error('CORS_ERROR');
      }
      throw error;
    }
  }

  private buildUIPrompt(request: AIGenerationRequest): string {
    const framework = request.framework || 'React';
    const isHTML = framework.toLowerCase() === 'html';
    
    // System instruction for all requests
    const systemInstruction = `You are an expert software developer. Generate clean, production-ready code based on the requirements. Always respond with valid JSON containing the file structure and code.

Focus on: Modern best practices, Responsive design, Accessibility, Performance, Security, Code readability, Proper error handling, Realistic sample data.`;
    
    if (isHTML) {
      return `${systemInstruction}

Generate a complete HTML/CSS/JavaScript website for: "${request.taskDescription}"

Requirements:
- Application name: ${request.appName}
- Framework: Pure HTML5, CSS3, and vanilla JavaScript
- Create a single-page website
- Use modern CSS (Flexbox/Grid) for responsive design
- Include CSS animations and hover effects
- Make it visually appealing and professional
- Add realistic content and imagery placeholders
- Include proper semantic HTML structure
- DO NOT use external CDNs (like Tailwind CSS CDN) - use inline styles

Please respond with JSON in this exact format:
{
  "files": [
    {
      "path": "index.html",
      "content": "<!-- Complete HTML document with embedded CSS and JS -->",
      "description": "Main HTML page"
    },
    {
      "path": "styles.css",
      "content": "/* Complete CSS styling */",
      "description": "Main stylesheet with responsive design"
    },
    {
      "path": "script.js",
      "content": "// Interactive JavaScript functionality",
      "description": "Main JavaScript file for interactivity"
    }
  ],
  "reasoning": "Explanation of the design approach and structure",
  "suggestions": ["Design improvement 1", "Feature enhancement 2"]
}

Focus on creating a beautiful, responsive website that works without any build tools or frameworks.
Use modern HTML5 features and CSS3 for styling. Make it production-ready.
`;
    } else {
      return `${systemInstruction}

Generate a complete React TypeScript application for: "${request.taskDescription}"

Requirements:
- Application name: ${request.appName}
- Framework: ${request.framework || 'React with TypeScript'}
- Create multiple components as needed
- Use modern CSS (Flexbox/Grid) for styling - DO NOT use Tailwind CSS CDN
- Include proper TypeScript types
- Make it functional and interactive
- Add realistic sample data
- Use semantic HTML structure

Please respond with JSON in this exact format:
{
  "files": [
    {
      "path": "src/App.tsx",
      "content": "// Complete React component code here",
      "description": "Main application component"
    },
    {
      "path": "src/components/ComponentName.tsx",
      "content": "// Component code here",
      "description": "Description of what this component does"
    }
  ],
  "reasoning": "Explanation of the approach and architecture decisions",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Focus on creating a working, interactive application that demonstrates the requested functionality.
Include at least 2-3 components and make sure the code is production-ready.
`;
    }
  }

  private buildBackendPrompt(request: AIGenerationRequest): string {
    return `
Generate a complete Express.js TypeScript backend for: "${request.taskDescription}"

Requirements:
- Application name: ${request.appName}
- Framework: Express.js with TypeScript
- Create REST API endpoints
- Include proper error handling
- Add input validation
- Use realistic data structures
- Include CORS and basic middleware

Please respond with JSON in this exact format:
{
  "files": [
    {
      "path": "server.ts",
      "content": "// Complete Express server code here",
      "description": "Main server file with Express setup"
    },
    {
      "path": "routes/apiRoutes.ts",
      "content": "// API routes code here",
      "description": "REST API endpoints"
    },
    {
      "path": "types/index.ts",
      "content": "// TypeScript type definitions",
      "description": "Type definitions for the application"
    }
  ],
  "reasoning": "Explanation of the API design and architecture decisions",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Focus on creating a RESTful API that supports CRUD operations for the requested functionality.
Include proper HTTP status codes, error handling, and TypeScript types.
`;
  }

  private parseAIResponse(responseText: string): AIGenerationResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!parsed.files || !Array.isArray(parsed.files)) {
        throw new Error('Invalid response structure: missing files array');
      }

      // Ensure each file has required properties
      const validFiles = parsed.files.map((file: any) => ({
        path: file.path || 'unknown.ts',
        content: file.content || '// Generated content',
        description: file.description || 'Generated file'
      }));

      return {
        files: validFiles,
        reasoning: parsed.reasoning || 'AI-generated code',
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      // Fallback: create a single file with the raw response
      console.warn('Failed to parse AI response as JSON:', error);
      return {
        files: [{
          path: 'generated.tsx',
          content: responseText,
          description: 'Raw AI response (parsing failed)'
        }],
        reasoning: 'Failed to parse structured response',
        suggestions: ['Consider refining the prompt for better JSON output']
      };
    }
  }

  async generateCode(
    apiKey: APIKey, 
    request: AIGenerationRequest
  ): Promise<AIGenerationResponse> {
    try {
      const prompt = request.type === 'ui' 
        ? this.buildUIPrompt(request)
        : this.buildBackendPrompt(request);

      let responseText: string;
      
      if (apiKey.provider === 'openai') {
        responseText = await this.callOpenAI(apiKey, prompt);
      } else if (apiKey.provider === 'anthropic') {
        responseText = await this.callAnthropic(apiKey, prompt);
      } else {
        throw new Error(`Unsupported provider: ${apiKey.provider}`);
      }

      return this.parseAIResponse(responseText);
    } catch (error) {
      console.error('AI generation failed:', error);
      throw new Error(`Failed to generate code: ${error}`);
    }
  }

  // Test method to verify API connectivity
  async testConnection(apiKey: APIKey): Promise<boolean> {
    try {
      const testRequest: AIGenerationRequest = {
        type: 'ui',
        taskDescription: 'Create a simple hello world component',
        appName: 'Test App'
      };

      await this.generateCode(apiKey, testRequest);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

export const aiService = new AIService();