import { callClaudeWithContext, type LLMProvider } from '../utils/claudeApi';

export interface GeneratedFile {
  filename: string;
  content: string;
  language?: string;
}

export interface AgentPromptRequest {
  agentType: 'ui' | 'backend' | 'manager';
  task: string;
  provider?: LLMProvider;
  context?: {
    projectName?: string;
    existingFiles?: string[];
    requirements?: string[];
  };
}

export async function promptAgent({
  agentType,
  task,
  provider = 'claude',
  context = {}
}: AgentPromptRequest): Promise<GeneratedFile[]> {
  const systemPrompts = {
    ui: `You are a UI developer AI working inside a multi-agent development platform called NeuronForge.
Your job is to create React TypeScript components with Tailwind CSS styling.

IMPORTANT: Respond with ONLY a JSON array in this exact format:
[
  { 
    "filename": "src/components/TodoList.tsx", 
    "content": "import React from 'react';\\n\\n// Component code here...", 
    "language": "typescript" 
  }
]

Rules:
- Use functional components with TypeScript interfaces
- Use Tailwind CSS for styling (no CSS files)
- Include proper imports and exports
- Make components interactive and functional
- Follow React best practices
- NO explanations, just the JSON array`,

    backend: `You are a Backend developer AI working inside a multi-agent development platform called NeuronForge.
Your job is to create Node.js/Express API endpoints and server logic.

IMPORTANT: Respond with ONLY a JSON array in this exact format:
[
  { 
    "filename": "server/routes/todos.js", 
    "content": "const express = require('express');\\n\\n// Route code here...", 
    "language": "javascript" 
  }
]

Rules:
- Use Express.js framework
- Include proper error handling
- Use RESTful API conventions
- Include input validation
- NO explanations, just the JSON array`,

    manager: `You are a Project Manager AI working inside a multi-agent development platform called NeuronForge.
Your job is to create project plans, configurations, and documentation.

IMPORTANT: Respond with ONLY a JSON array in this exact format:
[
  { 
    "filename": "README.md", 
    "content": "# Project Name\\n\\nProject description...", 
    "language": "markdown" 
  }
]

Rules:
- Create helpful documentation
- Include setup instructions
- Provide clear project structure
- NO explanations, just the JSON array`
  };

  const systemPrompt = systemPrompts[agentType];
  
  const contextInfo = context.existingFiles?.length 
    ? `\nExisting files in project: ${context.existingFiles.join(', ')}`
    : '';
    
  const projectInfo = context.projectName 
    ? `\nProject: ${context.projectName}`
    : '';

  const fullPrompt = `${task}${projectInfo}${contextInfo}

Please generate the appropriate ${agentType === 'ui' ? 'React components' : agentType === 'backend' ? 'API endpoints' : 'project files'} for this request.`;

  try {
    const response = await callClaudeWithContext(fullPrompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });

    // Try to parse the JSON response
    let parsedFiles: GeneratedFile[];
    try {
      // Clean the response - remove any markdown formatting
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsedFiles = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(parsedFiles)) {
        throw new Error('Response is not an array');
      }

      // Validate the structure
      parsedFiles = parsedFiles.filter(file => 
        file.filename && 
        file.content && 
        typeof file.filename === 'string' && 
        typeof file.content === 'string'
      );

      // Set default language if not provided
      parsedFiles = parsedFiles.map(file => ({
        ...file,
        language: file.language || getLanguageFromFilename(file.filename)
      }));

    } catch (parseError) {
      console.error('❌ LLM response is not valid JSON:', response);
      console.error('Parse error:', parseError);
      
      // Fallback: try to extract code from the response
      return extractCodeFromResponse(response, agentType);
    }

    console.log(`✅ ${agentType.toUpperCase()} Agent generated ${parsedFiles.length} files using ${provider.toUpperCase()}`);
    return parsedFiles;

  } catch (error) {
    console.error(`❌ ${agentType.toUpperCase()} Agent failed:`, error);
    throw error;
  }
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
      return 'typescript';
    case 'jsx':
    case 'js':
      return 'javascript';
    case 'md':
      return 'markdown';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    default:
      return 'text';
  }
}

function extractCodeFromResponse(response: string, agentType: string): GeneratedFile[] {
  // Fallback extraction when JSON parsing fails
  const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
  
  if (codeBlocks.length === 0) {
    // Create a single file with the entire response
    const extension = agentType === 'ui' ? '.tsx' : agentType === 'backend' ? '.js' : '.md';
    return [{
      filename: `src/${agentType}Generated${extension}`,
      content: response,
      language: getLanguageFromFilename(`file${extension}`)
    }];
  }

  return codeBlocks.map((block, index) => {
    const content = block.replace(/```[\w]*\n?/g, '').replace(/```$/g, '').trim();
    const extension = agentType === 'ui' ? '.tsx' : agentType === 'backend' ? '.js' : '.md';
    
    return {
      filename: `src/${agentType}Generated${index}${extension}`,
      content,
      language: getLanguageFromFilename(`file${extension}`)
    };
  });
}

// Helper function for quick UI component generation
export async function generateUIComponent(
  componentName: string, 
  description: string, 
  provider: LLMProvider = 'claude'
): Promise<GeneratedFile[]> {
  return promptAgent({
    agentType: 'ui',
    task: `Create a React TypeScript component called "${componentName}". ${description}`,
    provider
  });
}

// Helper function for backend API generation
export async function generateAPI(
  apiDescription: string, 
  provider: LLMProvider = 'claude'
): Promise<GeneratedFile[]> {
  return promptAgent({
    agentType: 'backend',
    task: `Create API endpoints for: ${apiDescription}`,
    provider
  });
}