import { useLogStore } from '../stores/logStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { FileNotifications } from './fileUpdateNotifications';

/**
 * Parsed file information from Claude's response
 */
export interface ParsedFile {
  path: string;
  content: string;
  language: string;
  size: number;
  lineCount: number;
}

/**
 * Result of parsing Claude's multi-file response
 */
export interface FileParseResult {
  files: ParsedFile[];
  totalFiles: number;
  totalSize: number;
  errors: string[];
  warnings: string[];
  success: boolean;
}

/**
 * Configuration for file parsing
 */
export interface FileParseConfig {
  validatePaths: boolean;
  sanitizePaths: boolean;
  maxFileSize: number; // In characters
  maxFiles: number;
  allowedExtensions?: string[];
  skipEmptyFiles: boolean;
  logParsing: boolean;
}

export const defaultFileParseConfig: FileParseConfig = {
  validatePaths: true,
  sanitizePaths: true,
  maxFileSize: 50000, // 50k characters max per file
  maxFiles: 20, // Max 20 files per response
  skipEmptyFiles: true,
  logParsing: true
};

/**
 * Parses Claude's multi-file response format
 * 
 * Expected format:
 * 📄 File: /path/to/file.ext
 * ```language
 * file content here
 * ```
 */
export function parseClaudeMultiFileResponse(
  text: string, 
  config: Partial<FileParseConfig> = {}
): FileParseResult {
  const cfg = { ...defaultFileParseConfig, ...config };
  const result: FileParseResult = {
    files: [],
    totalFiles: 0,
    totalSize: 0,
    errors: [],
    warnings: [],
    success: false
  };

  try {
    if (cfg.logParsing) {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'File Parser',
        message: '📄 Parsing Claude multi-file response...'
      });
    }

    // Enhanced regex that handles various file header formats
    const fileRegex = /📄\s*File:\s*(.+?)\s*```(\w+)?\s*\n([\s\S]*?)```/gi;
    const matches = Array.from(text.matchAll(fileRegex));

    if (matches.length === 0) {
      // Try alternative format without language specifier
      const simpleRegex = /📄\s*File:\s*(.+?)\s*```\s*\n([\s\S]*?)```/gi;
      const simpleMatches = Array.from(text.matchAll(simpleRegex));
      
      if (simpleMatches.length === 0) {
        result.warnings.push('No files found in expected format');
        if (cfg.logParsing) {
          useLogStore.getState().addLog({
            level: 'warn',
            source: 'File Parser',
            message: '⚠️ No files found in Claude response'
          });
        }
        return result;
      }
      
      // Process simple matches
      for (const match of simpleMatches) {
        const [, rawPath, content] = match;
        const processedFile = processFile(rawPath.trim(), content.trim(), '', cfg, result);
        if (processedFile) {
          result.files.push(processedFile);
        }
      }
    } else {
      // Process matches with language specifiers
      for (const match of matches) {
        const [, rawPath, language = '', content] = match;
        const processedFile = processFile(rawPath.trim(), content.trim(), language, cfg, result);
        if (processedFile) {
          result.files.push(processedFile);
        }
      }
    }

    // Validate results
    result.totalFiles = result.files.length;
    result.totalSize = result.files.reduce((sum, file) => sum + file.size, 0);
    result.success = result.files.length > 0 && result.errors.length === 0;

    // Check limits
    if (result.totalFiles > cfg.maxFiles) {
      result.warnings.push(`File count (${result.totalFiles}) exceeds limit (${cfg.maxFiles})`);
    }

    if (cfg.logParsing) {
      useLogStore.getState().addLog({
        level: result.success ? 'success' : 'warn',
        source: 'File Parser',
        message: `📄 Parsed ${result.totalFiles} files, ${result.totalSize} chars total${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`
      });
    }

    return result;

  } catch (error) {
    result.errors.push(`Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.success = false;
    
    if (cfg.logParsing) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'File Parser',
        message: `❌ Failed to parse Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return result;
  }
}

/**
 * Process a single file from the parsed response
 */
function processFile(
  rawPath: string,
  content: string,
  language: string,
  config: FileParseConfig,
  result: FileParseResult
): ParsedFile | null {
  try {
    // Sanitize and validate path
    let path = rawPath;
    
    if (config.sanitizePaths) {
      path = sanitizeFilePath(path);
    }
    
    if (config.validatePaths && !isValidFilePath(path)) {
      result.errors.push(`Invalid file path: ${rawPath}`);
      return null;
    }

    // Skip empty files if configured
    if (config.skipEmptyFiles && content.trim().length === 0) {
      result.warnings.push(`Skipping empty file: ${path}`);
      return null;
    }

    // Check file size
    if (content.length > config.maxFileSize) {
      result.warnings.push(`File ${path} exceeds size limit (${content.length} > ${config.maxFileSize})`);
      // Truncate rather than reject
      content = content.substring(0, config.maxFileSize) + '\n// [Content truncated due to size limit]';
    }

    // Detect language if not provided
    if (!language) {
      language = detectLanguageFromPath(path);
    }

    // Check allowed extensions
    if (config.allowedExtensions && config.allowedExtensions.length > 0) {
      const extension = getFileExtension(path);
      if (!config.allowedExtensions.includes(extension)) {
        result.warnings.push(`File ${path} has disallowed extension: ${extension}`);
      }
    }

    // Create parsed file object
    const parsedFile: ParsedFile = {
      path,
      content,
      language,
      size: content.length,
      lineCount: content.split('\n').length
    };

    return parsedFile;

  } catch (error) {
    result.errors.push(`Failed to process file ${rawPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Sanitize file path for safety
 */
function sanitizeFilePath(path: string): string {
  // Remove dangerous patterns
  let sanitized = path
    .replace(/\.\./g, '') // Remove directory traversal
    .replace(/\/+/g, '/') // Normalize slashes
    .replace(/^\/+/, '/') // Ensure single leading slash
    .trim();

  // Ensure it starts with / if it's an absolute path
  if (!sanitized.startsWith('/') && !sanitized.startsWith('./') && !sanitized.startsWith('../')) {
    sanitized = '/' + sanitized;
  }

  return sanitized;
}

/**
 * Validate file path format
 */
function isValidFilePath(path: string): boolean {
  // Basic validation rules
  if (!path || path.length === 0) return false;
  if (path.includes('..')) return false; // No directory traversal
  if (path.includes('//')) return false; // No double slashes
  if (!/^[/.]/.test(path)) return false; // Must start with / or .
  if (!/\.[a-zA-Z0-9]+$/.test(path)) return false; // Must have file extension
  
  return true;
}

/**
 * Detect programming language from file extension
 */
function detectLanguageFromPath(path: string): string {
  const extension = getFileExtension(path);
  
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.sh': 'bash',
    '.env': 'env'
  };

  return languageMap[extension.toLowerCase()] || 'plaintext';
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot > 0 ? path.substring(lastDot) : '';
}

/**
 * Apply parsed files to the file context store
 */
export function applyParsedFilesToContext(
  parseResult: FileParseResult,
  source: string = 'CLAUDE',
  options: {
    overwrite?: boolean;
    createBackup?: boolean;
    notifyUpdates?: boolean;
  } = {}
): {
  applied: number;
  skipped: number;
  errors: string[];
} {
  const { overwrite = true, createBackup = false, notifyUpdates = true } = options;
  const result = {
    applied: 0,
    skipped: 0,
    errors: []
  };

  if (!parseResult.success) {
    result.errors.push('Parse result was not successful');
    return result;
  }

  try {
    // Import file context dynamically to avoid circular deps
    const { useFileContext } = require('../stores/fileContextStore');
    const fileContext = useFileContext.getState();

    for (const file of parseResult.files) {
      try {
        // Check if file exists
        const existingFile = fileContext.getAllFiles()[file.path];
        
        if (existingFile && !overwrite) {
          result.skipped++;
          continue;
        }

        // Create backup if requested
        if (createBackup && existingFile) {
          const backupPath = `${file.path}.backup.${Date.now()}`;
          fileContext.updateFile(backupPath, existingFile.content, 'BACKUP');
        }

        // Apply the file update
        fileContext.updateFile(file.path, file.content, source);
        result.applied++;

        // Send notification if requested
        if (notifyUpdates) {
          useMessageBus.getState().sendMessage(MessagePatterns.log(
            source,
            `Updated file: ${file.path} (${file.size} chars)`,
            ['file-update', 'multi-file', 'claude-response']
          ));

          // Trigger visual notification
          const isExisting = existingFile !== undefined;
          FileNotifications[isExisting ? 'modified' : 'created'](
            file.path,
            source,
            file.size,
            file.content.substring(0, 200) // Preview
          );
        }

      } catch (error) {
        result.errors.push(`Failed to apply ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log overall results
    useLogStore.getState().addLog({
      level: result.errors.length > 0 ? 'warn' : 'success',
      source: 'File Parser',
      message: `📁 Applied ${result.applied} files, skipped ${result.skipped}${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`
    });

    // Send batch notification if multiple files were applied
    if (result.applied > 1 && notifyUpdates) {
      FileNotifications.batch(
        parseResult.files.map(file => ({
          path: file.path,
          size: file.size,
          content: file.content.substring(0, 100)
        })),
        source,
        {
          appliedCount: result.applied,
          skippedCount: result.skipped,
          errorCount: result.errors.length
        }
      );
    }

    return result;

  } catch (error) {
    result.errors.push(`File application failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Preview parsed files without applying them
 */
export function previewParsedFiles(parseResult: FileParseResult): string {
  if (!parseResult.success) {
    return `❌ Parse failed: ${parseResult.errors.join(', ')}`;
  }

  const preview = parseResult.files.map(file => {
    const sizeKB = (file.size / 1024).toFixed(1);
    return `📄 ${file.path} (${file.language}, ${sizeKB}KB, ${file.lineCount} lines)`;
  }).join('\n');

  const summary = `
📊 Multi-File Response Summary:
${preview}

Total: ${parseResult.totalFiles} files, ${(parseResult.totalSize / 1024).toFixed(1)}KB
${parseResult.warnings.length > 0 ? `\n⚠️ Warnings: ${parseResult.warnings.join(', ')}` : ''}
  `.trim();

  return summary;
}

/**
 * Convenience function for common use case
 */
export function parseAndApplyClaudeFiles(
  claudeResponse: string,
  source: string = 'CLAUDE',
  config: Partial<FileParseConfig> = {}
): {
  parseResult: FileParseResult;
  applyResult: ReturnType<typeof applyParsedFilesToContext>;
} {
  const parseResult = parseClaudeMultiFileResponse(claudeResponse, config);
  const applyResult = applyParsedFilesToContext(parseResult, source);

  return { parseResult, applyResult };
}

/**
 * Generate the multi-file format instruction for Claude prompts
 */
export function getMultiFileFormatInstruction(): string {
  return `
IMPORTANT: When generating or modifying files, use this EXACT format for each file:

📄 File: /full/path/to/file.ext
\`\`\`language
// File content here
\`\`\`

Examples:
📄 File: /src/components/Header.tsx
\`\`\`tsx
import React from 'react';

export function Header() {
  return <h1>Hello</h1>;
}
\`\`\`

📄 File: /src/utils/helpers.ts
\`\`\`ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
\`\`\`

Rules:
- Always use the 📄 File: prefix
- Include full file paths starting with /
- Specify the correct language in code blocks
- Include complete, working file content
- You can generate multiple files in one response
  `.trim();
}