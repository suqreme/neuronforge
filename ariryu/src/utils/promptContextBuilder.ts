import { getTokenCount, getRecommendedTokenLimit, TokenSafePromptBuilder, validateTokenUsage, formatTokenUsage } from './tokenUtils';
import { useFileContext, FileRecord } from '../stores/fileContextStore';
import { useMemoryStore, MemoryEntry } from '../stores/memoryStore';
import { useFeedbackStore, FeedbackEntry } from '../stores/feedbackStore';
import { useSelfCritiqueStore, CritiqueEntry } from '../stores/selfCritiqueStore';
import { useLogStore } from '../stores/logStore';
import { getMultiFileFormatInstruction } from './parseClaudeFileResponse';

/**
 * Configuration for context building
 */
export interface ContextBuilderConfig {
  maxTokens: number;
  taskType: 'simple' | 'complex' | 'file_generation' | 'planning';
  includeFiles: boolean;
  includeMemory: boolean;
  includeFeedback: boolean;
  includeCritiques: boolean;
  includeProjectState: boolean;
  
  // Prioritization weights (higher = more important)
  weights: {
    recentFeedback: number;
    negativeUserFeedback: number;
    positiveUserFeedback: number;
    selfCritiques: number;
    recentMemory: number;
    qualityMemory: number;
    recentFiles: number;
    targetFiles: number; // Files specifically mentioned in task
    projectOverview: number;
  };
  
  // Limits
  maxFiles: number;
  maxMemories: number;
  maxFeedbacks: number;
  maxCritiques: number;
  
  // Deduplication
  deduplicateContent: boolean;
  similarityThreshold: number; // 0-1, higher = more strict deduplication
}

export const defaultContextConfig: ContextBuilderConfig = {
  maxTokens: 80000, // Conservative default
  taskType: 'complex',
  includeFiles: true,
  includeMemory: true,
  includeFeedback: true,
  includeCritiques: true,
  includeProjectState: true,
  
  weights: {
    recentFeedback: 10,        // Highest priority - user feedback
    negativeUserFeedback: 15,  // Even higher for issues to fix
    positiveUserFeedback: 8,   // Patterns to continue
    selfCritiques: 6,          // AI self-reflection
    recentMemory: 7,           // Recent insights
    qualityMemory: 5,          // High-quality past decisions
    recentFiles: 4,            // Current codebase
    targetFiles: 12,           // Files specifically mentioned
    projectOverview: 3         // General context
  },
  
  maxFiles: 15,
  maxMemories: 20,
  maxFeedbacks: 10,
  maxCritiques: 8,
  
  deduplicateContent: true,
  similarityThreshold: 0.8
};

/**
 * Context building result
 */
export interface ContextBuildResult {
  context: string;
  tokenCount: number;
  includedSections: string[];
  excludedSections: string[];
  warnings: string[];
  stats: {
    filesIncluded: number;
    memoriesIncluded: number;
    feedbacksIncluded: number;
    critiquesIncluded: number;
    totalSources: number;
  };
}

/**
 * Smart context builder that prioritizes relevant information within token limits
 */
export class PromptContextBuilder {
  private config: ContextBuilderConfig;
  private seenContent: Set<string> = new Set();
  
  constructor(config: Partial<ContextBuilderConfig> = {}) {
    this.config = { ...defaultContextConfig, ...config };
    
    // Adjust max tokens based on task type if not explicitly set
    if (!config.maxTokens) {
      this.config.maxTokens = getRecommendedTokenLimit(this.config.taskType);
    }
  }
  
  /**
   * Build context for a given task
   */
  buildContext(task: string, targetFiles: string[] = []): ContextBuildResult {
    const builder = new TokenSafePromptBuilder(this.config.maxTokens);
    const warnings: string[] = [];
    const stats = {
      filesIncluded: 0,
      memoriesIncluded: 0,
      feedbacksIncluded: 0,
      critiquesIncluded: 0,
      totalSources: 0
    };
    
    this.seenContent.clear();
    
    try {
      // 1. Task description (always highest priority)
      builder.addContent(
        `🎯 TASK: ${task}`,
        100,
        'task-description'
      );
      
      // 2. User feedback (highest priority for context)
      if (this.config.includeFeedback) {
        const feedbackContext = this.buildFeedbackContext(targetFiles);
        if (feedbackContext.content) {
          builder.addContent(
            feedbackContext.content,
            feedbackContext.priority,
            'user-feedback'
          );
          stats.feedbacksIncluded = feedbackContext.count;
        }
      }
      
      // 3. Self-critiques
      if (this.config.includeCritiques) {
        const critiqueContext = this.buildCritiqueContext(targetFiles);
        if (critiqueContext.content) {
          builder.addContent(
            critiqueContext.content,
            critiqueContext.priority,
            'self-critiques'
          );
          stats.critiquesIncluded = critiqueContext.count;
        }
      }
      
      // 4. Target files (files specifically mentioned in task)
      if (this.config.includeFiles && targetFiles.length > 0) {
        const targetFilesContext = this.buildTargetFilesContext(targetFiles);
        if (targetFilesContext.content) {
          builder.addContent(
            targetFilesContext.content,
            this.config.weights.targetFiles,
            'target-files'
          );
          stats.filesIncluded += targetFilesContext.count;
        }
      }
      
      // 5. Relevant memory
      if (this.config.includeMemory) {
        const memoryContext = this.buildMemoryContext(task, targetFiles);
        if (memoryContext.content) {
          builder.addContent(
            memoryContext.content,
            memoryContext.priority,
            'memory-context'
          );
          stats.memoriesIncluded = memoryContext.count;
        }
      }
      
      // 6. Recent files (broader codebase context)
      if (this.config.includeFiles) {
        const recentFilesContext = this.buildRecentFilesContext(targetFiles);
        if (recentFilesContext.content) {
          builder.addContent(
            recentFilesContext.content,
            this.config.weights.recentFiles,
            'recent-files'
          );
          stats.filesIncluded += recentFilesContext.count;
        }
      }
      
      // 7. Project overview (lowest priority)
      if (this.config.includeProjectState) {
        const projectContext = this.buildProjectOverview();
        if (projectContext.content) {
          builder.addContent(
            projectContext.content,
            this.config.weights.projectOverview,
            'project-overview'
          );
        }
      }
      
      // 8. Multi-file format instructions (always include for file generation tasks)
      if (this.config.taskType === 'file_generation' || task.toLowerCase().includes('file') || task.toLowerCase().includes('create') || task.toLowerCase().includes('generate')) {
        builder.addContent(
          getMultiFileFormatInstruction(),
          50, // High priority for format instructions
          'multi-file-format'
        );
      }
      
      // Build final context
      const result = builder.build();
      
      // Validate token usage
      const validation = validateTokenUsage(result.tokenCount, this.config.maxTokens);
      if (!validation.isValid || validation.warning) {
        warnings.push(validation.warning || 'Token usage issue');
      }
      
      // Log context building
      useLogStore.getState().addLog({
        level: validation.severity === 'high' ? 'warn' : 'info',
        source: 'Prompt Context Builder',
        message: `📝 Built context: ${formatTokenUsage(result.tokenCount, this.config.maxTokens)} - ${stats.filesIncluded} files, ${stats.memoriesIncluded} memories, ${stats.feedbacksIncluded} feedbacks`
      });
      
      stats.totalSources = stats.filesIncluded + stats.memoriesIncluded + 
                          stats.feedbacksIncluded + stats.critiquesIncluded;
      
      return {
        context: result.prompt,
        tokenCount: result.tokenCount,
        includedSections: result.includedParts,
        excludedSections: result.excludedParts,
        warnings,
        stats
      };
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Prompt Context Builder',
        message: `Failed to build context: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Fallback to basic context
      return {
        context: `🎯 TASK: ${task}\n\n[Context building failed - using minimal context]`,
        tokenCount: getTokenCount(task),
        includedSections: ['task-description'],
        excludedSections: [],
        warnings: ['Context building failed'],
        stats
      };
    }
  }
  
  /**
   * Build user feedback context
   */
  private buildFeedbackContext(targetFiles: string[]): { content: string; priority: number; count: number } {
    const feedbackStore = useFeedbackStore.getState();
    
    // Get feedbacks for target files first
    let relevantFeedbacks: FeedbackEntry[] = [];
    
    targetFiles.forEach(filePath => {
      relevantFeedbacks.push(...feedbackStore.getFeedbacksForTarget(filePath));
    });
    
    // Add recent negative feedback (highest priority)
    const recentNegative = feedbackStore.getRecentNegativeFeedback(5)
      .filter(f => !relevantFeedbacks.find(rf => rf.id === f.id));
    relevantFeedbacks.push(...recentNegative);
    
    // Add recent positive feedback
    const recentPositive = feedbackStore.getRecentPositiveFeedback(3)
      .filter(f => !relevantFeedbacks.find(rf => rf.id === f.id));
    relevantFeedbacks.push(...recentPositive);
    
    // Limit and deduplicate
    relevantFeedbacks = relevantFeedbacks.slice(0, this.config.maxFeedbacks);
    
    if (relevantFeedbacks.length === 0) {
      return { content: '', priority: 0, count: 0 };
    }
    
    // Build feedback context
    const feedbackSections: string[] = [];
    
    const negatives = relevantFeedbacks.filter(f => f.rating <= 2);
    const positives = relevantFeedbacks.filter(f => f.rating >= 4);
    
    if (negatives.length > 0) {
      feedbackSections.push(
        `🚨 CRITICAL USER ISSUES TO ADDRESS:`,
        ...negatives.map(f => 
          `• ${f.metadata?.targetDisplay || f.target} (${f.rating}/5): "${f.feedback}" [${f.category}]`
        )
      );
    }
    
    if (positives.length > 0) {
      feedbackSections.push(
        `✅ USER-APPROVED PATTERNS TO CONTINUE:`,
        ...positives.map(f => 
          `• ${f.metadata?.targetDisplay || f.target} (${f.rating}/5): "${f.feedback}" [${f.category}]`
        )
      );
    }
    
    const content = `💬 USER FEEDBACK CONTEXT (HIGHEST PRIORITY):\n${feedbackSections.join('\n')}`;
    const priority = negatives.length > 0 ? this.config.weights.negativeUserFeedback : 
                    this.config.weights.positiveUserFeedback;
    
    return { content, priority, count: relevantFeedbacks.length };
  }
  
  /**
   * Build self-critique context
   */
  private buildCritiqueContext(targetFiles: string[]): { content: string; priority: number; count: number } {
    const critiqueStore = useSelfCritiqueStore.getState();
    
    // Get critiques for target files
    let relevantCritiques: CritiqueEntry[] = [];
    
    targetFiles.forEach(filePath => {
      relevantCritiques.push(...critiqueStore.getCritiquesForFile(filePath));
    });
    
    // Add recent low-quality critiques
    const lowQuality = critiqueStore.getLowQualityFiles(6)
      .filter(c => !relevantCritiques.find(rc => rc.id === c.id));
    relevantCritiques.push(...lowQuality);
    
    // Limit
    relevantCritiques = relevantCritiques
      .sort((a, b) => a.quality - b.quality) // Worst quality first
      .slice(0, this.config.maxCritiques);
    
    if (relevantCritiques.length === 0) {
      return { content: '', priority: 0, count: 0 };
    }
    
    const critiqueSections = relevantCritiques.map(c => 
      `• ${c.filePath} (${c.quality}/10): ${c.reasons.slice(0, 2).join(', ')}`
    );
    
    const content = `🔍 SELF-CRITIQUE INSIGHTS:\n${critiqueSections.join('\n')}`;
    
    return { 
      content, 
      priority: this.config.weights.selfCritiques, 
      count: relevantCritiques.length 
    };
  }
  
  /**
   * Build target files context
   */
  private buildTargetFilesContext(targetFiles: string[]): { content: string; priority: number; count: number } {
    const fileContext = useFileContext.getState();
    const allFiles = fileContext.getAllFiles();
    
    const relevantFiles: FileRecord[] = [];
    
    targetFiles.forEach(filePath => {
      const file = allFiles[filePath];
      if (file && !this.isDuplicate(file.content)) {
        relevantFiles.push(file);
      }
    });
    
    if (relevantFiles.length === 0) {
      return { content: '', priority: 0, count: 0 };
    }
    
    const fileSections = relevantFiles.map(file => 
      `📄 ${file.path} (${file.language}, ${file.size} chars):\n\`\`\`${file.language}\n${file.content}\n\`\`\``
    );
    
    const content = `🎯 TARGET FILES:\n${fileSections.join('\n\n')}`;
    
    return { 
      content, 
      priority: this.config.weights.targetFiles, 
      count: relevantFiles.length 
    };
  }
  
  /**
   * Build memory context
   */
  private buildMemoryContext(task: string, targetFiles: string[]): { content: string; priority: number; count: number } {
    const memoryStore = useMemoryStore.getState();
    const allMemories = memoryStore.getRecentMemory(50); // Get more to filter from
    
    // Score memories by relevance
    const scoredMemories = allMemories.map(memory => ({
      memory,
      score: this.scoreMemoryRelevance(memory, task, targetFiles)
    }))
    .filter(sm => sm.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, this.config.maxMemories);
    
    if (scoredMemories.length === 0) {
      return { content: '', priority: 0, count: 0 };
    }
    
    const memorySections = scoredMemories.map(({ memory }) => 
      `🧠 ${memory.type} (${new Date(memory.timestamp).toLocaleDateString()}): ${memory.content}`
    );
    
    const content = `🧠 RELEVANT MEMORY:\n${memorySections.join('\n')}`;
    const avgScore = scoredMemories.reduce((sum, sm) => sum + sm.score, 0) / scoredMemories.length;
    const priority = avgScore > 0.7 ? this.config.weights.qualityMemory : this.config.weights.recentMemory;
    
    return { 
      content, 
      priority, 
      count: scoredMemories.length 
    };
  }
  
  /**
   * Build recent files context
   */
  private buildRecentFilesContext(excludeFiles: string[]): { content: string; priority: number; count: number } {
    const fileContext = useFileContext.getState();
    const allFiles = Object.values(fileContext.getAllFiles());
    
    const recentFiles = allFiles
      .filter(file => 
        !excludeFiles.includes(file.path) && 
        !this.isDuplicate(file.content) &&
        file.size < 5000 // Exclude very large files
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.config.maxFiles);
    
    if (recentFiles.length === 0) {
      return { content: '', priority: 0, count: 0 };
    }
    
    const fileSections = recentFiles.map(file => 
      `📄 ${file.path} (${file.language}):\n\`\`\`${file.language}\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? '\n[truncated...]' : ''}\n\`\`\``
    );
    
    const content = `📁 RECENT CODEBASE:\n${fileSections.join('\n\n')}`;
    
    return { 
      content, 
      priority: this.config.weights.recentFiles, 
      count: recentFiles.length 
    };
  }
  
  /**
   * Build project overview context
   */
  private buildProjectOverview(): { content: string; priority: number; count: number } {
    const fileContext = useFileContext.getState();
    const fileStats = fileContext.getFileStats();
    
    const overview = `📊 PROJECT OVERVIEW:
• Total Files: ${fileStats.totalFiles}
• Total Lines: ${fileStats.totalLines}
• Languages: ${Object.keys(fileStats.languageBreakdown).join(', ')}
• Contributors: ${Object.keys(fileStats.agentContributions).join(', ')}`;
    
    return { 
      content: overview, 
      priority: this.config.weights.projectOverview, 
      count: 1 
    };
  }
  
  /**
   * Score memory relevance to current task
   */
  private scoreMemoryRelevance(memory: MemoryEntry, task: string, targetFiles: string[]): number {
    let score = 0;
    
    const taskLower = task.toLowerCase();
    const contentLower = memory.content.toLowerCase();
    
    // Check for keyword matches
    const taskWords = taskLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    const commonWords = taskWords.filter(word => contentWords.includes(word) && word.length > 3);
    score += commonWords.length * 0.1;
    
    // Boost for recent memories
    const ageHours = (Date.now() - memory.timestamp) / (1000 * 60 * 60);
    if (ageHours < 24) score += 0.3;
    else if (ageHours < 72) score += 0.1;
    
    // Boost for relevant types
    if (memory.type === 'feedback' || memory.type === 'planning') score += 0.2;
    if (memory.type === 'error' || memory.type === 'warning') score += 0.1;
    
    // Check if memory mentions target files
    targetFiles.forEach(filePath => {
      if (contentLower.includes(filePath.toLowerCase())) {
        score += 0.4;
      }
    });
    
    return Math.min(score, 1.0); // Cap at 1.0
  }
  
  /**
   * Check if content is duplicate (simple similarity check)
   */
  private isDuplicate(content: string): boolean {
    if (!this.config.deduplicateContent) return false;
    
    const contentHash = this.simpleHash(content);
    
    if (this.seenContent.has(contentHash)) {
      return true;
    }
    
    this.seenContent.add(contentHash);
    return false;
  }
  
  /**
   * Simple hash for content deduplication
   */
  private simpleHash(content: string): string {
    // Simple hash based on content length and first/last characters
    const normalized = content.trim().replace(/\s+/g, ' ');
    return `${normalized.length}-${normalized.substring(0, 50)}-${normalized.substring(-50)}`;
  }
}

/**
 * Convenience function to build context with default configuration
 */
export function buildPromptContext(
  task: string, 
  targetFiles: string[] = [], 
  config: Partial<ContextBuilderConfig> = {}
): ContextBuildResult {
  const builder = new PromptContextBuilder(config);
  return builder.buildContext(task, targetFiles);
}

/**
 * Builds context optimized for different task types
 */
export const ContextBuilders = {
  /**
   * For simple tasks - minimal context
   */
  simple: (task: string, targetFiles: string[] = []) => 
    buildPromptContext(task, targetFiles, {
      taskType: 'simple',
      maxTokens: 20000,
      maxFiles: 5,
      maxMemories: 5,
      maxFeedbacks: 3,
      includeProjectState: false
    }),
    
  /**
   * For file generation - focused on relevant files and feedback
   */
  fileGeneration: (task: string, targetFiles: string[] = []) =>
    buildPromptContext(task, targetFiles, {
      taskType: 'file_generation',
      maxTokens: 100000,
      weights: {
        ...defaultContextConfig.weights,
        targetFiles: 20,
        negativeUserFeedback: 18,
        recentFeedback: 15
      }
    }),
    
  /**
   * For planning - comprehensive context
   */
  planning: (task: string, targetFiles: string[] = []) =>
    buildPromptContext(task, targetFiles, {
      taskType: 'planning',
      maxTokens: 120000,
      includeProjectState: true
    }),
    
  /**
   * For debugging - error-focused context
   */
  debugging: (task: string, targetFiles: string[] = []) =>
    buildPromptContext(task, targetFiles, {
      taskType: 'complex',
      maxTokens: 80000,
      weights: {
        ...defaultContextConfig.weights,
        negativeUserFeedback: 20,
        selfCritiques: 10
      }
    })
};