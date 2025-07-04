// Utility for extracting code from AI responses

export interface ExtractedFile {
  path: string;
  content: string;
  language: string;
}

// Extract code blocks from markdown-style responses
export function extractCodeFromMarkdown(response: string): string {
  // Look for code blocks with ```typescript, ```javascript, ```tsx, etc.
  const codeBlockRegex = /```(?:tsx?|jsx?|typescript|javascript|css|html|json)?\n([\s\S]*?)\n```/g;
  const matches = [...response.matchAll(codeBlockRegex)];
  
  if (matches.length > 0) {
    // Return the first code block found
    return matches[0][1].trim();
  }
  
  // Fallback: look for any code block
  const anyCodeBlock = response.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
  if (anyCodeBlock) {
    return anyCodeBlock[1].trim();
  }
  
  // If no code blocks, look for import statements (likely React component)
  const importMatch = response.match(/(import.*[\s\S]*?export\s+default.*)/);
  if (importMatch) {
    return importMatch[1].trim();
  }
  
  // Last resort: return the whole response if it looks like code
  if (response.includes('import ') || response.includes('function ') || response.includes('const ')) {
    return response.trim();
  }
  
  return '';
}

// Extract multiple files from AI response with filename annotations
export function extractMultipleFiles(response: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  
  // Pattern 1: ```typescript filename="src/App.tsx"
  const filenamePattern = /```(\w+)\s+filename=["']([^"']+)["']\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = filenamePattern.exec(response)) !== null) {
    const [, language, path, content] = match;
    files.push({
      path,
      content: content.trim(),
      language: normalizeLanguage(language)
    });
  }
  
  // Pattern 2: // File: src/App.tsx followed by code block
  const fileCommentPattern = /\/\/\s*File:\s*([^\n]+)\n```(\w+)?\n([\s\S]*?)\n```/g;
  
  while ((match = fileCommentPattern.exec(response)) !== null) {
    const [, path, language, content] = match;
    files.push({
      path: path.trim(),
      content: content.trim(),
      language: normalizeLanguage(language || getLanguageFromPath(path))
    });
  }
  
  // Pattern 3: **src/App.tsx** followed by code block
  const markdownFilePattern = /\*\*([^*]+)\*\*\n```(\w+)?\n([\s\S]*?)\n```/g;
  
  while ((match = markdownFilePattern.exec(response)) !== null) {
    const [, path, language, content] = match;
    files.push({
      path: path.trim(),
      content: content.trim(),
      language: normalizeLanguage(language || getLanguageFromPath(path))
    });
  }
  
  // If no multi-file patterns found, try to extract a single file
  if (files.length === 0) {
    const singleCode = extractCodeFromMarkdown(response);
    if (singleCode) {
      // Try to guess filename from response context
      const filename = guessFilename(response, singleCode);
      files.push({
        path: filename,
        content: singleCode,
        language: getLanguageFromPath(filename)
      });
    }
  }
  
  return files;
}

// Normalize language names
function normalizeLanguage(language: string): string {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'tsx':
    case 'ts':
    case 'typescript':
      return 'typescript';
    case 'jsx':
    case 'js':
    case 'javascript':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    default:
      return lang || 'typescript';
  }
}

// Get language from file path
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'tsx':
    case 'ts':
      return 'typescript';
    case 'jsx':
    case 'js':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    default:
      return 'typescript';
  }
}

// Guess filename from response content and code
function guessFilename(response: string, code: string): string {
  // Look for component name in the code
  const componentMatch = code.match(/(?:function|const|class)\s+(\w+)/);
  const componentName = componentMatch?.[1];
  
  // Check if response mentions specific files
  const filePathMatch = response.match(/(?:create|write|file|save)\s+(?:.*?(?:src\/)?([a-zA-Z0-9\/._-]+\.(?:tsx?|jsx?|css|html)))/i);
  if (filePathMatch) {
    return filePathMatch[1].startsWith('src/') ? filePathMatch[1] : `src/${filePathMatch[1]}`;
  }
  
  // Default based on component name or generic
  if (componentName && componentName !== 'App') {
    return `src/components/${componentName}.tsx`;
  }
  
  // Check response context for clues
  if (response.toLowerCase().includes('app') || response.toLowerCase().includes('main')) {
    return 'src/App.tsx';
  }
  
  if (response.toLowerCase().includes('component')) {
    return 'src/components/Component.tsx';
  }
  
  // Last resort
  return 'src/Generated.tsx';
}

// Extract just the imports from code
export function extractImports(code: string): string[] {
  const importRegex = /^import\s+.*$/gm;
  return code.match(importRegex) || [];
}

// Extract exports from code
export function extractExports(code: string): string[] {
  const exportRegex = /^export\s+.*$/gm;
  return code.match(exportRegex) || [];
}

// Check if code looks like a React component
export function isReactComponent(code: string): boolean {
  return (
    code.includes('import React') ||
    code.includes('import { ') ||
    code.includes('export default') ||
    code.includes('function ') ||
    code.includes('const ') ||
    code.includes('return (') ||
    code.includes('JSX.Element') ||
    code.includes('React.FC')
  );
}