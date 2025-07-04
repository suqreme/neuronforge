import { callClaudeWithContext } from '../utils/claudeApi';
import { useLogStore } from '../stores/logStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../stores/messageBus';
import { useMemoryStore } from '../stores/memoryStore';
import { useFileContext } from '../stores/fileContextStore';
import { useSelfCritiqueStore } from '../stores/selfCritiqueStore';

export interface CritiqueResult {
  status: 'approved' | 'needs_improvement' | 'rejected';
  explanation: string;
  improvedContent?: string;
  suggestions: string[];
  confidence: number;
  timestamp: number;
}

export interface CritiqueMetrics {
  codeQuality: number; // 0-10
  readability: number; // 0-10
  maintainability: number; // 0-10
  performance: number; // 0-10
  security: number; // 0-10
  overallScore: number; // 0-10
}

export async function reviewFile(path: string, content: string, context?: string): Promise<CritiqueResult> {
  const { addLog } = useLogStore.getState();
  const { sendMessage } = useMessageBus.getState();
  const { addMemory } = useMemoryStore.getState();

  try {
    addLog({
      level: 'info',
      source: 'Claude Critic',
      message: `Starting self-review of ${path} (${content.length} chars)`
    });

    // Send review start notification
    sendMessage(MessagePatterns.log(
      'CLAUDE_CRITIC',
      `🔍 Self-reviewing ${path}...`,
      ['self-review', 'code-quality']
    ));

    const fileExtension = path.split('.').pop()?.toLowerCase();
    const language = getLanguageFromExtension(fileExtension);
    
    // Truncate content if too long to avoid token limits
    const maxContentLength = 6000;
    const truncatedContent = content.length > maxContentLength 
      ? content.slice(0, maxContentLength) + '\n// ... (truncated)'
      : content;

    const prompt = `You are a senior AI code reviewer conducting a thorough self-critique.

File being reviewed: ${path}
Language: ${language}
${context ? `Context: ${context}` : ''}

FILE CONTENT:
\`\`\`${language}
${truncatedContent}
\`\`\`

REVIEW CRITERIA:
- Code quality and best practices
- Readability and clarity
- Performance considerations
- Security vulnerabilities
- Maintainability and extensibility
- TypeScript/JavaScript specific issues
- React/component patterns (if applicable)
- Error handling and edge cases

RESPONSE FORMAT:
Provide a JSON response with this exact structure:

{
  "status": "approved" | "needs_improvement" | "rejected",
  "explanation": "Detailed explanation of the review findings",
  "improvedContent": "Improved version of the code (only if status is needs_improvement)",
  "suggestions": ["List of specific improvement suggestions"],
  "metrics": {
    "codeQuality": 8,
    "readability": 7,
    "maintainability": 9,
    "performance": 6,
    "security": 8,
    "overallScore": 7.6
  },
  "confidence": 0.85
}

GUIDELINES:
- "approved": Code is high quality, minimal issues, score >= 8.0
- "needs_improvement": Code has issues but is salvageable, score 5.0-7.9
- "rejected": Code has major issues, score < 5.0
- Only provide improvedContent if status is "needs_improvement"
- Be constructive and specific in suggestions
- Consider the context and purpose of the code

Return ONLY the JSON, no markdown or additional text.`;

    const response = await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });

    // Parse the response
    const critiqueData = JSON.parse(response);
    
    const result: CritiqueResult = {
      status: critiqueData.status || 'needs_improvement',
      explanation: critiqueData.explanation || 'No explanation provided',
      improvedContent: critiqueData.improvedContent,
      suggestions: critiqueData.suggestions || [],
      confidence: Math.min(Math.max(critiqueData.confidence || 0.5, 0), 1),
      timestamp: Date.now()
    };

    // Calculate overall score from metrics
    const metrics = critiqueData.metrics;
    if (metrics) {
      const overallScore = (
        metrics.codeQuality +
        metrics.readability +
        metrics.maintainability +
        metrics.performance +
        metrics.security
      ) / 5;
      metrics.overallScore = Math.round(overallScore * 10) / 10;
    }

    // Log the results
    const statusEmoji = {
      'approved': '✅',
      'needs_improvement': '🛠️',
      'rejected': '❌'
    }[result.status];

    addLog({
      level: result.status === 'approved' ? 'success' : result.status === 'rejected' ? 'error' : 'warn',
      source: 'Claude Critic',
      message: `${statusEmoji} Review complete: ${result.status.toUpperCase()} - ${result.explanation.substring(0, 100)}...`
    });

    // Send review completion notification
    sendMessage({
      sender: 'CLAUDE_CRITIC',
      receiver: 'ALL',
      type: 'completion',
      content: `${statusEmoji} Code review ${result.status}: ${path} (Score: ${metrics?.overallScore || 'N/A'}/10)`,
      priority: result.status === 'rejected' ? 'high' : 'medium',
      metadata: {
        tags: ['self-review', 'code-quality', result.status],
        filePath: path,
        status: result.status,
        overallScore: metrics?.overallScore,
        confidence: result.confidence
      }
    });

    // Store review in memory
    addMemory(
      `Self-review of ${path}: ${result.status.toUpperCase()} - ${result.explanation.substring(0, 150)}...`,
      'code_review',
      {
        filePath: path,
        status: result.status,
        overallScore: metrics?.overallScore,
        confidence: result.confidence,
        suggestionCount: result.suggestions.length,
        hasImprovedContent: !!result.improvedContent,
        importance: result.status === 'rejected' ? 'high' : 'medium',
        tags: ['self-critique', 'quality-assurance', result.status]
      }
    );

    // Add to global self-critique store stats
    try {
      const { addReviewResult } = useSelfCritiqueStore.getState();
      addReviewResult({
        status: result.status,
        confidence: result.confidence,
        score: metrics?.overallScore,
        filePath: path,
        wasImproved: !!result.improvedContent
      });
    } catch (error) {
      console.warn('Failed to update self-critique store:', error);
    }

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    addLog({
      level: 'error',
      source: 'Claude Critic',
      message: `Review failed: ${errorMsg}`
    });

    // Return fallback result
    return {
      status: 'needs_improvement',
      explanation: `Review failed due to error: ${errorMsg}. Manual review recommended.`,
      suggestions: ['Manual code review required due to critic system error'],
      confidence: 0.1,
      timestamp: Date.now()
    };
  }
}

// Review multiple files in a batch
export async function reviewFiles(files: Array<{path: string, content: string}>): Promise<CritiqueResult[]> {
  const results: CritiqueResult[] = [];
  
  useLogStore.getState().addLog({
    level: 'info',
    source: 'Claude Critic',
    message: `Starting batch review of ${files.length} files`
  });

  for (const file of files) {
    try {
      const result = await reviewFile(file.path, file.content);
      results.push(result);
      
      // Small delay between reviews to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to review ${file.path}:`, error);
    }
  }

  // Summary report
  const approved = results.filter(r => r.status === 'approved').length;
  const needsImprovement = results.filter(r => r.status === 'needs_improvement').length;
  const rejected = results.filter(r => r.status === 'rejected').length;

  useLogStore.getState().addLog({
    level: 'info',
    source: 'Claude Critic',
    message: `Batch review complete: ${approved} approved, ${needsImprovement} need improvement, ${rejected} rejected`
  });

  return results;
}

// Quick quality check for a file
export async function quickQualityCheck(path: string, content: string): Promise<number> {
  try {
    const prompt = `Rate the overall code quality of this file from 0-10:

File: ${path}
\`\`\`
${content.slice(0, 2000)}
\`\`\`

Consider: syntax, structure, readability, best practices.
Respond with only a number from 0-10.`;

    const response = await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });

    const score = parseFloat(response.trim());
    return isNaN(score) ? 5 : Math.min(Math.max(score, 0), 10);
  } catch (error) {
    console.error('Quick quality check failed:', error);
    return 5; // Neutral score on error
  }
}

// Auto-improve a file based on critique
export async function autoImproveFile(path: string, content: string, critiqueResult: CritiqueResult): Promise<string> {
  if (critiqueResult.status === 'approved' || !critiqueResult.improvedContent) {
    return content; // No improvement needed or available
  }

  try {
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Critic',
      message: `Auto-improving ${path} based on critique`
    });

    // If we have improved content from the critique, use it
    if (critiqueResult.improvedContent) {
      return critiqueResult.improvedContent;
    }

    // Otherwise, generate improvements based on suggestions
    const prompt = `Improve this code based on the following critique:

File: ${path}
Current code:
\`\`\`
${content}
\`\`\`

Issues identified:
${critiqueResult.explanation}

Suggestions:
${critiqueResult.suggestions.join('\n')}

Return only the improved code, no explanations.`;

    const response = await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });

    return response.trim();
  } catch (error) {
    console.error('Auto-improvement failed:', error);
    return content; // Return original on error
  }
}

// Get critique statistics for the current session
export function getCritiqueStats(): {
  totalReviews: number;
  approved: number;
  needsImprovement: number;
  rejected: number;
  averageScore: number;
} {
  const memories = useMemoryStore.getState().getAllEntries();
  const reviewMemories = memories.filter(m => m.type === 'code_review');

  const stats = {
    totalReviews: reviewMemories.length,
    approved: 0,
    needsImprovement: 0,
    rejected: 0,
    averageScore: 0
  };

  let totalScore = 0;
  let scoreCount = 0;

  reviewMemories.forEach(memory => {
    const metadata = memory.metadata;
    if (metadata?.status) {
      stats[metadata.status as keyof typeof stats]++;
    }
    if (typeof metadata?.overallScore === 'number') {
      totalScore += metadata.overallScore;
      scoreCount++;
    }
  });

  stats.averageScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

  return stats;
}

// Helper function to determine language from file extension
function getLanguageFromExtension(extension?: string): string {
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    default:
      return 'plaintext';
  }
}