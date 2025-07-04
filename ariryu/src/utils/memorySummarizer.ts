import { useFileContext } from '../stores/fileContextStore';
import { useAgentFeedbackStore } from '../stores/agentFeedbackStore';
import { useMemoryStore } from '../stores/memoryStore';
import { checkTokenLimits } from './tokenUsageMonitor';
import { useTokenBudgetStore } from '../stores/tokenBudgetStore';

/**
 * Configuration for memory summarization
 */
export interface MemorySummaryConfig {
  maxFiles: number; // Maximum files to include
  maxFeedbacks: number; // Maximum feedbacks to include
  maxTokens: number; // Maximum tokens for the summary
  prioritizeRecent: boolean; // Whether to prioritize recent items
  includeFileContent: boolean; // Whether to include file content snippets
  qualityThreshold: number; // Minimum quality score for feedback inclusion
}

export const defaultMemoryConfig: MemorySummaryConfig = {
  maxFiles: 20,
  maxFeedbacks: 15,
  maxTokens: 3000, // Conservative token limit
  prioritizeRecent: true,
  includeFileContent: false, // Start conservative to prevent token burns
  qualityThreshold: 0.6
};

/**
 * Memory summary structure
 */
export interface MemorySummary {
  files: {
    path: string;
    updatedBy: string;
    size: number;
    language: string;
    timestamp: number;
    summary: string;
    content?: string; // Optional content snippet
  }[];
  feedbacks: {
    agent: string;
    targetFile: string;
    feedback: string;
    qualityScore: number;
    category: string;
    timestamp: number;
  }[];
  projectMemories: {
    content: string;
    type: string;
    timestamp: number;
    metadata?: any;
  }[];
  stats: {
    totalFiles: number;
    totalFeedbacks: number;
    totalMemories: number;
    estimatedTokens: number;
    generatedAt: number;
  };
  context: string; // Formatted context for Claude
}

/**
 * Generates a comprehensive memory summary for Claude planning
 */
export function generateMemorySummary(config: Partial<MemorySummaryConfig> = {}): MemorySummary {
  const finalConfig = { ...defaultMemoryConfig, ...config };
  
  // Check token budget for memory summarization
  const tokenBudget = useTokenBudgetStore.getState();
  if (!tokenBudget.isMemorySummaryAllowed()) {
    const analytics = tokenBudget.getAnalytics();
    console.warn(`Memory summarization blocked by token budget system (${Math.round(analytics.usagePercentage * 100)}% daily usage)`);
    return generateMinimalSummary();
  }

  try {
    // Check legacy token limits before proceeding
    checkTokenLimits();
  } catch (error) {
    // If token limits are exceeded, use minimal summary
    return generateMinimalSummary();
  }
  
  const fileStore = useFileContext.getState();
  const feedbackStore = useAgentFeedbackStore.getState();
  const memoryStore = useMemoryStore.getState();
  
  // Get and filter files
  const allFiles = Object.values(fileStore.files);
  const sortedFiles = finalConfig.prioritizeRecent 
    ? allFiles.sort((a, b) => b.timestamp - a.timestamp)
    : allFiles.sort((a, b) => a.path.localeCompare(b.path));
  
  const selectedFiles = sortedFiles.slice(0, finalConfig.maxFiles);
  
  // Get and filter feedbacks
  const allFeedbacks = feedbackStore.getRecentFeedbacks(100);
  const qualityFeedbacks = allFeedbacks.filter(f => f.qualityScore >= finalConfig.qualityThreshold);
  const selectedFeedbacks = qualityFeedbacks.slice(0, finalConfig.maxFeedbacks);
  
  // Get project memories
  const allMemories = memoryStore.getAllMemories();
  const selectedMemories = finalConfig.prioritizeRecent
    ? allMemories.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    : allMemories.slice(0, 10);
  
  // Build file summaries
  const fileSummaries = selectedFiles.map(file => {
    const summary = generateFileSummary(file);
    let content: string | undefined;
    
    if (finalConfig.includeFileContent && file.size < 1000) {
      // Only include content for small files to prevent token burns
      content = file.content.substring(0, 300) + (file.content.length > 300 ? '...' : '');
    }
    
    return {
      path: file.path,
      updatedBy: file.lastUpdatedBy,
      size: file.size,
      language: file.language || 'unknown',
      timestamp: file.timestamp,
      summary,
      content
    };
  });
  
  // Build feedback summaries
  const feedbackSummaries = selectedFeedbacks.map(feedback => ({
    agent: feedback.agent,
    targetFile: feedback.targetFile,
    feedback: truncateText(feedback.feedback, 150),
    qualityScore: feedback.qualityScore,
    category: feedback.category,
    timestamp: feedback.timestamp
  }));
  
  // Build project memory summaries
  const memorySummaries = selectedMemories.map(memory => ({
    content: truncateText(memory.content, 200),
    type: memory.type,
    timestamp: memory.timestamp,
    metadata: memory.metadata
  }));
  
  // Generate formatted context
  const context = formatMemoryContext(fileSummaries, feedbackSummaries, memorySummaries, finalConfig);
  
  // Estimate tokens (rough calculation: 1 token ≈ 4 characters)
  const estimatedTokens = Math.ceil(context.length / 4);
  
  const summary: MemorySummary = {
    files: fileSummaries,
    feedbacks: feedbackSummaries,
    projectMemories: memorySummaries,
    stats: {
      totalFiles: allFiles.length,
      totalFeedbacks: allFeedbacks.length,
      totalMemories: allMemories.length,
      estimatedTokens,
      generatedAt: Date.now()
    },
    context
  };
  
  // If estimated tokens exceed limit, generate a reduced summary
  if (estimatedTokens > finalConfig.maxTokens) {
    return generateReducedSummary(finalConfig);
  }
  
  return summary;
}

/**
 * Generates a minimal memory summary for token safety
 */
function generateMinimalSummary(): MemorySummary {
  const fileStore = useFileContext.getState();
  const feedbackStore = useAgentFeedbackStore.getState();
  
  const recentFiles = Object.values(fileStore.files)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  const recentFeedbacks = feedbackStore.getRecentFeedbacks(5);
  
  const context = `
🗃️ Recent Files (${recentFiles.length}):
${recentFiles.map(f => `• ${f.path} (${f.language}, ${f.lastUpdatedBy})`).join('\n')}

🧠 Recent Feedback (${recentFeedbacks.length}):
${recentFeedbacks.map(f => `• ${f.targetFile}: ${f.qualityScore}% quality`).join('\n')}

⚠️ Token limit reached - using minimal summary
  `.trim();
  
  return {
    files: recentFiles.map(f => ({
      path: f.path,
      updatedBy: f.lastUpdatedBy,
      size: f.size,
      language: f.language || 'unknown',
      timestamp: f.timestamp,
      summary: 'Minimal summary due to token limits'
    })),
    feedbacks: recentFeedbacks.map(f => ({
      agent: f.agent,
      targetFile: f.targetFile,
      feedback: truncateText(f.feedback, 50),
      qualityScore: f.qualityScore,
      category: f.category,
      timestamp: f.timestamp
    })),
    projectMemories: [],
    stats: {
      totalFiles: recentFiles.length,
      totalFeedbacks: recentFeedbacks.length,
      totalMemories: 0,
      estimatedTokens: Math.ceil(context.length / 4),
      generatedAt: Date.now()
    },
    context
  };
}

/**
 * Generates a reduced summary when token limit is approached
 */
function generateReducedSummary(config: MemorySummaryConfig): MemorySummary {
  // Recursively reduce limits until under token threshold
  const reducedConfig = {
    ...config,
    maxFiles: Math.floor(config.maxFiles * 0.7),
    maxFeedbacks: Math.floor(config.maxFeedbacks * 0.7),
    includeFileContent: false
  };
  
  return generateMemorySummary(reducedConfig);
}

/**
 * Generates a summary for a single file
 */
function generateFileSummary(file: any): string {
  const parts = [];
  
  if (file.routes && file.routes.length > 0) {
    parts.push(`${file.routes.length} API routes`);
  }
  
  if (file.lineCount) {
    parts.push(`${file.lineCount} lines`);
  }
  
  if (file.metadata?.isNew) {
    parts.push('new file');
  }
  
  if (file.metadata?.hasUnsavedChanges) {
    parts.push('unsaved changes');
  }
  
  return parts.length > 0 ? parts.join(', ') : 'code file';
}

/**
 * Formats memory context for Claude
 */
function formatMemoryContext(
  files: any[],
  feedbacks: any[],
  memories: any[],
  config: MemorySummaryConfig
): string {
  const sections = [];
  
  // File section
  if (files.length > 0) {
    sections.push(`
🗃️ Project Files (${files.length} most relevant):
${files.map(f => {
  let line = `• ${f.path} (${f.language}, by ${f.updatedBy}, ${f.summary})`;
  if (f.content && config.includeFileContent) {
    line += `\n  📄 ${f.content}`;
  }
  return line;
}).join('\n')}
    `.trim());
  }
  
  // Feedback section
  if (feedbacks.length > 0) {
    sections.push(`
🧠 Agent Feedback History (${feedbacks.length} quality reviews):
${feedbacks.map(f => 
  `• ${f.targetFile}: ${f.feedback} (${Math.round(f.qualityScore * 100)}% quality, ${f.category})`
).join('\n')}
    `.trim());
  }
  
  // Project memory section
  if (memories.length > 0) {
    sections.push(`
💭 Project Memory:
${memories.map(m => `• [${m.type}] ${m.content}`).join('\n')}
    `.trim());
  }
  
  // Analysis section
  const analysis = generateContextAnalysis(files, feedbacks);
  if (analysis) {
    sections.push(`
🔍 Context Analysis:
${analysis}
    `.trim());
  }
  
  return sections.join('\n\n');
}

/**
 * Generates analysis of the current context
 */
function generateContextAnalysis(files: any[], feedbacks: any[]): string {
  const analysis = [];
  
  // File type analysis
  const languages = files.reduce((acc, file) => {
    acc[file.language] = (acc[file.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topLanguages = Object.entries(languages)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);
    
  if (topLanguages.length > 0) {
    analysis.push(`Primary languages: ${topLanguages.map(([lang, count]) => `${lang} (${count})`).join(', ')}`);
  }
  
  // Agent activity analysis
  const agents = files.reduce((acc, file) => {
    acc[file.updatedBy] = (acc[file.updatedBy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topAgents = Object.entries(agents)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);
    
  if (topAgents.length > 0) {
    analysis.push(`Most active agents: ${topAgents.map(([agent, count]) => `${agent} (${count})`).join(', ')}`);
  }
  
  // Feedback quality analysis
  if (feedbacks.length > 0) {
    const avgQuality = feedbacks.reduce((sum, f) => sum + f.qualityScore, 0) / feedbacks.length;
    analysis.push(`Average code quality: ${Math.round(avgQuality * 100)}%`);
    
    const categories = feedbacks.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topCategory = Object.entries(categories)
      .sort(([,a], [,b]) => b - a)[0];
      
    if (topCategory) {
      analysis.push(`Main feedback category: ${topCategory[0]} (${topCategory[1]} issues)`);
    }
  }
  
  return analysis.join('; ');
}

/**
 * Truncates text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Gets a formatted memory context string for Claude
 */
export function getMemoryContextForClaude(config?: Partial<MemorySummaryConfig>): string {
  const summary = generateMemorySummary(config);
  return summary.context;
}

/**
 * Gets memory summary stats for display
 */
export function getMemoryStats(): {
  totalFiles: number;
  totalFeedbacks: number;
  totalMemories: number;
  avgQuality: number;
  lastUpdated: number;
} {
  const fileStore = useFileContext.getState();
  const feedbackStore = useAgentFeedbackStore.getState();
  const memoryStore = useMemoryStore.getState();
  
  const allFiles = Object.values(fileStore.files);
  const allFeedbacks = feedbackStore.getRecentFeedbacks(1000);
  const allMemories = memoryStore.getAllMemories();
  
  const avgQuality = allFeedbacks.length > 0 
    ? allFeedbacks.reduce((sum, f) => sum + f.qualityScore, 0) / allFeedbacks.length
    : 0;
    
  const lastUpdated = Math.max(
    allFiles.length > 0 ? Math.max(...allFiles.map(f => f.timestamp)) : 0,
    allFeedbacks.length > 0 ? Math.max(...allFeedbacks.map(f => f.timestamp)) : 0,
    allMemories.length > 0 ? Math.max(...allMemories.map(m => m.timestamp)) : 0
  );
  
  return {
    totalFiles: allFiles.length,
    totalFeedbacks: allFeedbacks.length,
    totalMemories: allMemories.length,
    avgQuality,
    lastUpdated
  };
}

/**
 * Hook for components to use memory summarization
 */
export function useMemorySummary() {
  return {
    generateSummary: (config?: Partial<MemorySummaryConfig>) => generateMemorySummary(config),
    getContextForClaude: (config?: Partial<MemorySummaryConfig>) => getMemoryContextForClaude(config),
    getStats: () => getMemoryStats(),
    defaultConfig: defaultMemoryConfig
  };
}