# NeuronForge AI Generation Prompts

## UI Generation Prompts

### React/TypeScript Application Prompt
```
Generate a complete React TypeScript application for: "{taskDescription}"

Requirements:
- Application name: {appName}
- Framework: {framework || 'React with TypeScript'}
- Create multiple components as needed
- Use modern CSS (Flexbox/Grid) for styling
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
```

### HTML/CSS/JavaScript Website Prompt
```
Generate a complete HTML/CSS/JavaScript website for: "{taskDescription}"

Requirements:
- Application name: {appName}
- Framework: Pure HTML5, CSS3, and vanilla JavaScript
- Create a single-page website
- Use modern CSS (Flexbox/Grid) for responsive design
- Include CSS animations and hover effects
- Make it visually appealing and professional
- Add realistic content and imagery placeholders
- Include proper semantic HTML structure

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
```

## Backend Generation Prompt

### Express.js TypeScript API Prompt
```
Generate a complete Express.js TypeScript backend for: "{taskDescription}"

Requirements:
- Application name: {appName}
- Framework: Express.js with TypeScript
- Create REST API endpoints
- Include proper error handling
- Add input validation
- Use realistic data structures
- Include CORS and basic middleware
- Add comprehensive API documentation

Please respond with JSON in this exact format:
{
  "files": [
    {
      "path": "server.ts",
      "content": "// Complete Express server code",
      "description": "Main server file with middleware setup"
    },
    {
      "path": "routes/apiRoutes.ts",
      "content": "// API routes implementation",
      "description": "API endpoint definitions"
    },
    {
      "path": "types/index.ts",
      "content": "// TypeScript type definitions",
      "description": "Type definitions for the API"
    }
  ],
  "reasoning": "Explanation of the API design and architecture decisions",
  "suggestions": ["API improvement 1", "Security enhancement 2"]
}

Focus on creating a production-ready API with proper error handling, validation, and documentation.
Include realistic endpoints that would work with the frontend application.
```

## System Instructions

You are an expert software developer. Generate clean, production-ready code based on the requirements. Always respond with valid JSON containing the file structure and code.

Focus on:
- Modern best practices
- Responsive design
- Accessibility
- Performance
- Security
- Code readability
- Proper error handling
- Realistic sample data