import { useFileContext, FileRecord } from '../stores/fileContextStore';
import { useLogStore } from '../stores/logStore';
import { useMemoryStore } from '../stores/memoryStore';

export interface ReviewableFile {
  path: string;
  content: string;
  language: string;
  size: number;
  lineCount: number;
  lastUpdatedBy: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ReviewIssue {
  type: 'bug' | 'performance' | 'style' | 'best-practice' | 'security' | 'maintainability';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  line?: number;
  suggestion?: string;
}

export interface ReviewResult {
  path: string;
  issues: ReviewIssue[];
  suggestedContent?: string;
  confidence: number;
  needsReview: boolean;
}

/**
 * Gathers all project files for Claude to review
 */
export function gatherProjectFiles(): ReviewableFile[] {
  const { getAllFiles } = useFileContext.getState();
  const allFiles = getAllFiles();
  
  return Object.values(allFiles)
    .filter(file => shouldIncludeInReview(file))
    .map(file => ({
      path: file.path,
      content: file.content,
      language: file.language || 'plaintext',
      size: file.size,
      lineCount: file.lineCount,
      lastUpdatedBy: file.lastUpdatedBy,
      priority: calculateFilePriority(file)
    }))
    .sort((a, b) => {
      // Sort by priority and then by size (smaller files first for quicker fixes)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.size - b.size;
    });
}

/**
 * Determines if a file should be included in the review
 */
function shouldIncludeInReview(file: FileRecord): boolean {
  // Skip very large files
  if (file.size > 50000) return false;
  
  // Skip generated or build files
  const skipPatterns = [
    '/dist/',
    '/build/',
    '/node_modules/',
    '.min.js',
    '.bundle.js',
    '.map',
    '.d.ts',
    '/assets/',
    '/public/',
    'package-lock.json',
    'yarn.lock'
  ];
  
  if (skipPatterns.some(pattern => file.path.includes(pattern))) {
    return false;
  }
  
  // Include source code files
  const includeExtensions = [
    '.ts', '.tsx', '.js', '.jsx',
    '.py', '.java', '.go', '.rs',
    '.css', '.scss', '.html',
    '.vue', '.svelte'
  ];
  
  return includeExtensions.some(ext => file.path.endsWith(ext));
}

/**
 * Calculates the priority of a file for review
 */
function calculateFilePriority(file: FileRecord): 'high' | 'medium' | 'low' {
  // High priority: Core components and utilities
  if (
    file.path.includes('/stores/') ||
    file.path.includes('/utils/') ||
    file.path.includes('/agents/') ||
    file.path.includes('App.tsx') ||
    file.path.includes('index.ts')
  ) {
    return 'high';
  }
  
  // Medium priority: Components and business logic
  if (
    file.path.includes('/components/') ||
    file.path.includes('/services/') ||
    file.path.includes('/hooks/')
  ) {
    return 'medium';
  }
  
  // Low priority: Tests, configs, and documentation
  return 'low';
}

/**
 * Creates a comprehensive review prompt for Claude
 */
export function createReviewPrompt(files: ReviewableFile[]): string {
  const projectContext = gatherProjectContext();
  
  return `You are a senior software engineer conducting a comprehensive code review for the NeuronForge AI development platform. 

PROJECT CONTEXT:
${projectContext}

REVIEW OBJECTIVES:
1. Identify and fix bugs, logic errors, and potential runtime issues
2. Improve code quality, readability, and maintainability
3. Optimize performance and remove dead code
4. Ensure TypeScript best practices and proper typing
5. Fix security vulnerabilities and potential issues
6. Improve error handling and edge cases
7. Add missing documentation where critical

IMPORTANT GUIDELINES:
- Only return files that actually need fixing (don't include perfect files)
- Preserve existing functionality - this is a quality improvement, not a rewrite
- Focus on high-impact changes that provide real value
- Maintain existing code style and patterns
- Keep changes minimal and focused
- Add comments only where the code logic is complex or non-obvious

RESPONSE FORMAT:
Return a JSON array of files that need fixing:
[
  {
    "path": "/src/example.tsx",
    "content": "// Fixed file content here...",
    "changes": [
      "Fixed undefined variable access",
      "Added proper error handling", 
      "Improved TypeScript types"
    ],
    "confidence": 0.9
  }
]

Return ONLY the JSON array, no additional text or markdown.

FILES TO REVIEW:
${files.map(file => `
---
Path: ${file.path}
Language: ${file.language}
Priority: ${file.priority}
Size: ${file.size} chars, ${file.lineCount} lines
Last updated by: ${file.lastUpdatedBy}

Content:
${file.content}
`).join('\n')}`;
}

/**
 * Gathers project context for better review quality
 */
function gatherProjectContext(): string {
  const { getMemoryCount } = useMemoryStore.getState();
  const { getAllFiles } = useFileContext.getState();
  
  const files = getAllFiles();
  const fileCount = Object.keys(files).length;
  const totalLines = Object.values(files).reduce((sum, file) => sum + file.lineCount, 0);
  
  const languages = new Set(Object.values(files).map(f => f.language).filter(Boolean));
  const components = Object.keys(files).filter(path => path.includes('/components/')).length;
  const utilities = Object.keys(files).filter(path => path.includes('/utils/')).length;
  const stores = Object.keys(files).filter(path => path.includes('/stores/')).length;
  
  return `
NeuronForge is a React + TypeScript AI development platform that helps users build web applications through natural language.

CURRENT PROJECT STATE:
- ${fileCount} total files (${totalLines} lines of code)
- Languages: ${Array.from(languages).join(', ')}
- ${components} React components
- ${utilities} utility modules  
- ${stores} Zustand stores
- ${getMemoryCount()} memory entries

TECH STACK:
- Frontend: React 18+, TypeScript, Tailwind CSS
- State Management: Zustand
- Editor: Monaco Editor
- Build: Vite
- Architecture: Modular workbench with AI agents

KEY PATTERNS:
- Use Zustand for state management
- Tailwind CSS for styling (no inline styles)
- TypeScript strict mode
- Functional React components with hooks
- Message bus for agent communication
- File context store for real-time file tracking
`.trim();
}

/**
 * Validates Claude's review response
 */
export function validateReviewResponse(response: string): ReviewResult[] | null {
  try {
    const parsed = JSON.parse(response);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response must be an array');
    }
    
    // Validate each result
    const results: ReviewResult[] = parsed.map((item: any) => {
      if (!item.path || !item.content) {
        throw new Error('Each result must have path and content');
      }
      
      return {
        path: item.path,
        issues: [], // We'll extract this from changes if needed
        suggestedContent: item.content,
        confidence: item.confidence || 0.8,
        needsReview: true
      };
    });
    
    return results;
    
  } catch (error) {
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Self Review',
      message: `Failed to parse Claude review response: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return null;
  }
}

/**
 * Analyzes the changes Claude made to a file
 */
export function analyzeFileChanges(originalContent: string, newContent: string): string[] {
  if (originalContent === newContent) {
    return ['No changes made'];
  }
  
  const changes: string[] = [];
  
  // Simple change detection
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');
  
  if (newLines.length !== originalLines.length) {
    changes.push(`Line count changed: ${originalLines.length} → ${newLines.length}`);
  }
  
  // Count significant changes
  let changedLines = 0;
  const maxLines = Math.max(originalLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const original = originalLines[i] || '';
    const updated = newLines[i] || '';
    
    if (original.trim() !== updated.trim()) {
      changedLines++;
    }
  }
  
  if (changedLines > 0) {
    changes.push(`${changedLines} lines modified`);
  }
  
  // Look for common improvements
  if (newContent.includes('try {') && !originalContent.includes('try {')) {
    changes.push('Added error handling');
  }
  
  if (newContent.includes('// ') && originalContent.split('// ').length < newContent.split('// ').length) {
    changes.push('Added documentation comments');
  }
  
  if (newContent.includes(': ') && originalContent.split(': ').length < newContent.split(': ').length) {
    changes.push('Improved TypeScript typing');
  }
  
  if (originalContent.includes('any') && !newContent.includes('any')) {
    changes.push('Replaced any types with specific types');
  }
  
  return changes.length > 0 ? changes : ['Code quality improvements'];
}

/**
 * Gets a summary of files ready for review
 */
export function getReviewSummary(): {
  totalFiles: number;
  highPriorityFiles: number;
  totalLines: number;
  languages: string[];
  estimatedReviewTime: string;
} {
  const files = gatherProjectFiles();
  
  return {
    totalFiles: files.length,
    highPriorityFiles: files.filter(f => f.priority === 'high').length,
    totalLines: files.reduce((sum, f) => sum + f.lineCount, 0),
    languages: Array.from(new Set(files.map(f => f.language))),
    estimatedReviewTime: `${Math.ceil(files.length / 5)}-${Math.ceil(files.length / 2)} minutes`
  };
}