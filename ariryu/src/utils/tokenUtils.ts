/**
 * Token estimation and management utilities for Claude prompts
 * Provides rough token counting to stay within API limits
 */

/**
 * Rough token estimation based on character count
 * This is an approximation - actual token count may vary
 * Generally: 1 token ≈ 3-4 characters for English text
 */
export function getTokenCount(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // Remove extra whitespace and normalize
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  
  // Rough estimation: 1 token per 3.5 characters on average
  // This accounts for common programming patterns, markdown, etc.
  const estimatedTokens = Math.ceil(normalizedText.length / 3.5);
  
  return estimatedTokens;
}

/**
 * More detailed token estimation for code and mixed content
 */
export function getDetailedTokenCount(text: string): {
  estimated: number;
  characters: number;
  words: number;
  lines: number;
  confidence: 'low' | 'medium' | 'high';
} {
  if (!text || typeof text !== 'string') {
    return {
      estimated: 0,
      characters: 0,
      words: 0,
      lines: 0,
      confidence: 'high'
    };
  }

  const characters = text.length;
  const lines = text.split('\n').length;
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  
  let estimatedTokens: number;
  let confidence: 'low' | 'medium' | 'high';
  
  // Adjust estimation based on content type
  if (text.includes('```') || text.includes('function') || text.includes('import')) {
    // Code content - tends to be more token-dense
    estimatedTokens = Math.ceil(characters / 3.2);
    confidence = 'medium';
  } else if (text.includes('{') && text.includes('}')) {
    // JSON or object content
    estimatedTokens = Math.ceil(characters / 3.0);
    confidence = 'medium';
  } else {
    // Regular text content
    estimatedTokens = Math.ceil(characters / 4.0);
    confidence = 'high';
  }
  
  return {
    estimated: estimatedTokens,
    characters,
    words,
    lines,
    confidence
  };
}

/**
 * Token limits for different Claude models
 */
export const TOKEN_LIMITS = {
  // Conservative limits to leave room for response
  CLAUDE_3_HAIKU: 150000,    // Actually 200k, but leave buffer
  CLAUDE_3_SONNET: 150000,   // Actually 200k, but leave buffer
  CLAUDE_3_OPUS: 150000,     // Actually 200k, but leave buffer
  CLAUDE_3_5_SONNET: 150000, // Actually 200k, but leave buffer
  
  // Practical limits for prompt context (leaving room for response)
  SAFE_PROMPT_LIMIT: 120000,
  CONSERVATIVE_LIMIT: 80000,
  BASIC_LIMIT: 40000
} as const;

/**
 * Gets recommended token limit based on task complexity
 */
export function getRecommendedTokenLimit(taskType: 'simple' | 'complex' | 'file_generation' | 'planning'): number {
  switch (taskType) {
    case 'simple':
      return TOKEN_LIMITS.BASIC_LIMIT;
    case 'complex':
      return TOKEN_LIMITS.CONSERVATIVE_LIMIT;
    case 'file_generation':
      return TOKEN_LIMITS.SAFE_PROMPT_LIMIT;
    case 'planning':
      return TOKEN_LIMITS.CONSERVATIVE_LIMIT;
    default:
      return TOKEN_LIMITS.BASIC_LIMIT;
  }
}

/**
 * Chunks text to fit within token limits
 */
export function chunkTextByTokens(text: string, maxTokens: number): string[] {
  if (!text) return [];
  
  const totalTokens = getTokenCount(text);
  
  if (totalTokens <= maxTokens) {
    return [text];
  }
  
  // Split by paragraphs first, then by sentences if needed
  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = getTokenCount(paragraph);
    
    if (currentTokens + paragraphTokens <= maxTokens) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
        currentTokens = 0;
      }
      
      // If single paragraph is too long, split by sentences
      if (paragraphTokens > maxTokens) {
        const sentences = paragraph.split(/[.!?]+/);
        for (const sentence of sentences) {
          const sentenceTokens = getTokenCount(sentence);
          
          if (currentTokens + sentenceTokens <= maxTokens) {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
            currentTokens += sentenceTokens;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = sentence;
              currentTokens = sentenceTokens;
            }
          }
        }
      } else {
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Truncates text to fit within token limit, preserving important content
 */
export function truncateToTokenLimit(text: string, maxTokens: number, preserveStart = true): string {
  const totalTokens = getTokenCount(text);
  
  if (totalTokens <= maxTokens) {
    return text;
  }
  
  // Calculate rough character limit
  const charactersPerToken = text.length / totalTokens;
  const maxCharacters = Math.floor(maxTokens * charactersPerToken);
  
  if (preserveStart) {
    return text.substring(0, maxCharacters) + '\n\n[Content truncated due to token limit]';
  } else {
    const startIndex = text.length - maxCharacters;
    return '[Content truncated due to token limit]\n\n' + text.substring(startIndex);
  }
}

/**
 * Validates token usage and provides warnings
 */
export function validateTokenUsage(tokenCount: number, limit: number): {
  isValid: boolean;
  warning?: string;
  severity: 'none' | 'low' | 'medium' | 'high';
  percentUsed: number;
} {
  const percentUsed = (tokenCount / limit) * 100;
  
  if (tokenCount > limit) {
    return {
      isValid: false,
      warning: `Token count (${tokenCount}) exceeds limit (${limit})`,
      severity: 'high',
      percentUsed
    };
  }
  
  if (percentUsed > 90) {
    return {
      isValid: true,
      warning: `Token usage is very high (${percentUsed.toFixed(1)}%)`,
      severity: 'high',
      percentUsed
    };
  }
  
  if (percentUsed > 75) {
    return {
      isValid: true,
      warning: `Token usage is high (${percentUsed.toFixed(1)}%)`,
      severity: 'medium',
      percentUsed
    };
  }
  
  if (percentUsed > 50) {
    return {
      isValid: true,
      warning: `Token usage is moderate (${percentUsed.toFixed(1)}%)`,
      severity: 'low',
      percentUsed
    };
  }
  
  return {
    isValid: true,
    severity: 'none',
    percentUsed
  };
}

/**
 * Optimizes text for token efficiency while preserving meaning
 */
export function optimizeForTokens(text: string): string {
  if (!text) return text;
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove empty lines (but preserve intentional breaks)
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim
    .trim();
}

/**
 * Formats token usage for logging
 */
export function formatTokenUsage(tokenCount: number, limit: number): string {
  const percentage = ((tokenCount / limit) * 100).toFixed(1);
  const emoji = tokenCount > limit ? '🔴' : 
                percentage >= '90' ? '🟠' :
                percentage >= '75' ? '🟡' :
                '🟢';
  
  return `${emoji} ${tokenCount.toLocaleString()}/${limit.toLocaleString()} tokens (${percentage}%)`;
}

/**
 * Utility to safely build prompts with token awareness
 */
export class TokenSafePromptBuilder {
  private parts: Array<{ content: string; priority: number; id: string }> = [];
  private maxTokens: number;
  
  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
  }
  
  /**
   * Add content with priority (higher priority = more likely to be included)
   */
  addContent(content: string, priority: number = 1, id: string = crypto.randomUUID()): this {
    if (content && content.trim()) {
      this.parts.push({ content: content.trim(), priority, id });
    }
    return this;
  }
  
  /**
   * Build the final prompt, respecting token limits
   */
  build(): { prompt: string; includedParts: string[]; excludedParts: string[]; tokenCount: number } {
    // Sort by priority (highest first)
    const sortedParts = [...this.parts].sort((a, b) => b.priority - a.priority);
    
    const includedParts: string[] = [];
    const excludedParts: string[] = [];
    let currentTokens = 0;
    let prompt = '';
    
    for (const part of sortedParts) {
      const partTokens = getTokenCount(part.content);
      
      if (currentTokens + partTokens <= this.maxTokens) {
        includedParts.push(part.id);
        prompt += (prompt ? '\n\n' : '') + part.content;
        currentTokens += partTokens;
      } else {
        excludedParts.push(part.id);
      }
    }
    
    return {
      prompt,
      includedParts,
      excludedParts,
      tokenCount: currentTokens
    };
  }
  
  /**
   * Get current token count estimate
   */
  estimateTokens(): number {
    return this.parts.reduce((total, part) => total + getTokenCount(part.content), 0);
  }
  
  /**
   * Clear all content
   */
  clear(): this {
    this.parts = [];
    return this;
  }
}