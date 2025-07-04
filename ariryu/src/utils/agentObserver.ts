import { useFileContext, FileRecord } from '../stores/fileContextStore';
import { useAgentFeedbackStore, FeedbackUtils } from '../stores/agentFeedbackStore';
import { useLogStore } from '../stores/logStore';
import { useMemoryStore } from '../stores/memoryStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { askClaudeToAnalyzeQuality } from './claudeApi';
import { checkTokenLimits } from './tokenUsageMonitor';
import { AgentFeedback } from '../types';

/**
 * Configuration for the agent observer system
 */
export interface ObserverConfig {
  enabled: boolean;
  reviewThreshold: number; // Minimum file size to trigger review
  maxReviewsPerHour: number; // Rate limiting to prevent token burns
  excludeAgents: string[]; // Agents to skip reviewing
  onlyReviewLanguages: string[]; // Only review these file types
  batchSize: number; // Maximum files to review in one batch
  cooldownMinutes: number; // Minimum time between reviews for same agent
}

export const defaultObserverConfig: ObserverConfig = {
  enabled: false, // Disabled by default for safety
  reviewThreshold: 100, // Only review files > 100 characters
  maxReviewsPerHour: 10, // Strict limit to prevent token burns
  excludeAgents: ['CLAUDE', 'CLAUDE_SELF_REVIEW', 'SYSTEM'], // Don't review Claude's own output
  onlyReviewLanguages: ['typescript', 'javascript', 'python'], // Focus on code files
  batchSize: 3, // Review max 3 files at once
  cooldownMinutes: 15 // Wait 15 minutes between reviews of same agent
};

/**
 * Tracks review history to prevent token burns
 */
interface ReviewHistory {
  lastReviewTime: number;
  reviewCount: number;
  hourlyReviewCount: number;
  lastHourReset: number;
}

class AgentObserver {
  private config: ObserverConfig = defaultObserverConfig;
  private reviewHistory = new Map<string, ReviewHistory>();
  private pendingReviews = new Set<string>();
  
  /**
   * Updates observer configuration
   */
  updateConfig(newConfig: Partial<ObserverConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Agent Observer',
      message: `Configuration updated: ${this.config.enabled ? 'enabled' : 'disabled'}, max ${this.config.maxReviewsPerHour} reviews/hour`
    });
  }
  
  /**
   * Observes file changes and triggers reviews when appropriate
   */
  async observeFileChange(file: FileRecord): Promise<void> {
    if (!this.config.enabled) return;
    
    try {
      // Check if this file should be reviewed
      if (!this.shouldReviewFile(file)) {
        return;
      }
      
      // Check rate limits
      if (!this.checkRateLimits(file.lastUpdatedBy)) {
        return;
      }
      
      // Prevent duplicate reviews
      const reviewKey = `${file.lastUpdatedBy}:${file.path}`;
      if (this.pendingReviews.has(reviewKey)) {
        return;
      }
      
      this.pendingReviews.add(reviewKey);
      
      try {
        await this.reviewAgentOutput(file);
      } finally {
        this.pendingReviews.delete(reviewKey);
      }
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Agent Observer',
        message: `Failed to observe file change: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Determines if a file should be reviewed
   */
  private shouldReviewFile(file: FileRecord): boolean {
    // Skip if file is too small
    if (file.size < this.config.reviewThreshold) {
      return false;
    }
    
    // Skip excluded agents
    if (this.config.excludeAgents.includes(file.lastUpdatedBy)) {
      return false;
    }
    
    // Only review specified languages
    if (file.language && !this.config.onlyReviewLanguages.includes(file.language)) {
      return false;
    }
    
    // Skip binary or generated files
    if (this.isBinaryOrGenerated(file.path)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Checks if binary or generated file
   */
  private isBinaryOrGenerated(filePath: string): boolean {
    const skipPatterns = [
      '.min.js', '.bundle.js', '.map', '.d.ts',
      '/dist/', '/build/', '/node_modules/',
      '.png', '.jpg', '.gif', '.svg', '.ico'
    ];
    
    return skipPatterns.some(pattern => filePath.includes(pattern));
  }
  
  /**
   * Checks rate limits to prevent token burns
   */
  private checkRateLimits(agentId: string): boolean {
    const now = Date.now();
    const history = this.reviewHistory.get(agentId) || {
      lastReviewTime: 0,
      reviewCount: 0,
      hourlyReviewCount: 0,
      lastHourReset: now
    };
    
    // Reset hourly counter if needed
    if (now - history.lastHourReset > 60 * 60 * 1000) {
      history.hourlyReviewCount = 0;
      history.lastHourReset = now;
    }
    
    // Check hourly limit
    if (history.hourlyReviewCount >= this.config.maxReviewsPerHour) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Agent Observer',
        message: `Rate limit reached for ${agentId}: ${history.hourlyReviewCount}/${this.config.maxReviewsPerHour} reviews this hour`
      });
      return false;
    }
    
    // Check cooldown period
    const timeSinceLastReview = now - history.lastReviewTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    if (timeSinceLastReview < cooldownMs) {
      return false;
    }
    
    // Check global token limits
    try {
      checkTokenLimits();
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Agent Observer',
        message: `Token limit exceeded, skipping review: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * Reviews agent output and generates feedback
   */
  private async reviewAgentOutput(file: FileRecord): Promise<void> {
    try {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Agent Observer',
        message: `🔍 Reviewing ${file.lastUpdatedBy} output: ${file.path}`
      });
      
      // Update review history
      const now = Date.now();
      const history = this.reviewHistory.get(file.lastUpdatedBy) || {
        lastReviewTime: 0,
        reviewCount: 0,
        hourlyReviewCount: 0,
        lastHourReset: now
      };
      
      history.lastReviewTime = now;
      history.reviewCount++;
      history.hourlyReviewCount++;
      this.reviewHistory.set(file.lastUpdatedBy, history);
      
      // Generate lightweight feedback using pattern analysis first
      const quickFeedback = this.generateQuickFeedback(file);
      
      // Only use Claude for complex analysis if needed
      let detailedFeedback: string | null = null;
      if (quickFeedback.qualityScore < 0.7 || quickFeedback.suggestions.length > 2) {
        try {
          detailedFeedback = await this.getClaudeFeedback(file);
        } catch (error) {
          useLogStore.getState().addLog({
            level: 'warn',
            source: 'Agent Observer',
            message: `Claude review failed for ${file.path}, using quick feedback only`
          });
        }
      }
      
      // Create feedback entry
      const feedback = FeedbackUtils.createFeedback(
        file.lastUpdatedBy,
        'CLAUDE_OBSERVER',
        file.path,
        detailedFeedback || quickFeedback.feedback,
        quickFeedback.qualityScore,
        quickFeedback.category,
        quickFeedback.severity,
        quickFeedback.suggestions
      );
      
      // Add metadata
      feedback.metadata = {
        fileSize: file.size,
        language: file.language || 'unknown',
        lineCount: file.lineCount,
        complexity: this.calculateComplexity(file.content),
        tags: ['auto-generated', 'pattern-analysis']
      };
      
      if (detailedFeedback) {
        feedback.metadata.tags.push('claude-reviewed');
      }
      
      // Store feedback
      useAgentFeedbackStore.getState().addFeedback(feedback);
      
      // Send notification
      useMessageBus.getState().sendMessage(MessagePatterns.log(
        'AGENT_OBSERVER',
        `Generated feedback for ${file.lastUpdatedBy}: ${quickFeedback.feedback.substring(0, 50)}...`,
        ['feedback', 'agent-observer', file.lastUpdatedBy.toLowerCase()]
      ));
      
      // Add to memory for training
      useMemoryStore.getState().addMemory(
        `Agent feedback for ${file.lastUpdatedBy}: ${quickFeedback.feedback}`,
        'agent_feedback',
        {
          agent: file.lastUpdatedBy,
          qualityScore: quickFeedback.qualityScore,
          category: quickFeedback.category,
          filePath: file.path,
          timestamp: now,
          tags: ['feedback', 'training-data']
        }
      );
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Agent Observer',
        message: `Review failed for ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Generates quick feedback using pattern analysis (no API calls)
   */
  private generateQuickFeedback(file: FileRecord): {
    feedback: string;
    qualityScore: number;
    category: AgentFeedback['category'];
    severity: AgentFeedback['severity'];
    suggestions: string[];
  } {
    const content = file.content;
    const lines = content.split('\n');
    const issues: string[] = [];
    const suggestions: string[] = [];
    let qualityScore = 1.0;
    
    // Code quality checks
    if (content.includes('any')) {
      issues.push('Uses any types');
      suggestions.push('Replace any types with specific types');
      qualityScore -= 0.1;
    }
    
    if (content.includes('console.log')) {
      issues.push('Contains console.log statements');
      suggestions.push('Remove or replace console.log with proper logging');
      qualityScore -= 0.05;
    }
    
    if (lines.some(line => line.length > 120)) {
      issues.push('Lines exceed 120 characters');
      suggestions.push('Break long lines for better readability');
      qualityScore -= 0.05;
    }
    
    // Function complexity
    const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
    const lineCount = lines.length;
    if (functionCount > 0 && lineCount / functionCount > 50) {
      issues.push('Functions are too long');
      suggestions.push('Break down large functions into smaller ones');
      qualityScore -= 0.1;
    }
    
    // Missing error handling
    if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
      issues.push('Missing error handling for async code');
      suggestions.push('Add try-catch blocks for async operations');
      qualityScore -= 0.15;
    }
    
    // Determine category and severity
    let category: AgentFeedback['category'] = 'code_quality';
    let severity: AgentFeedback['severity'] = 'low';
    
    if (issues.length > 3) {
      severity = 'high';
      qualityScore -= 0.1;
    } else if (issues.length > 1) {
      severity = 'medium';
    }
    
    if (content.includes('security') || content.includes('password') || content.includes('token')) {
      category = 'security';
      if (content.includes('password') && !content.includes('hash')) {
        severity = 'high';
        qualityScore -= 0.2;
      }
    }
    
    // Generate feedback message
    const feedback = issues.length > 0 
      ? `Found ${issues.length} issue(s): ${issues.join(', ')}`
      : 'Code quality looks good';
    
    return {
      feedback,
      qualityScore: Math.max(0, qualityScore),
      category,
      severity,
      suggestions
    };
  }
  
  /**
   * Gets detailed feedback from Claude (used sparingly)
   */
  private async getClaudeFeedback(file: FileRecord): Promise<string> {
    const reviewableFile = {
      path: file.path,
      content: file.content,
      language: file.language || 'unknown',
      size: file.size,
      lineCount: file.lineCount,
      lastUpdatedBy: file.lastUpdatedBy,
      priority: 'medium' as const
    };
    
    return await askClaudeToAnalyzeQuality([reviewableFile]);
  }
  
  /**
   * Calculates code complexity (simple metric)
   */
  private calculateComplexity(content: string): number {
    // Simple complexity calculation
    const cyclomaticKeywords = ['if', 'for', 'while', 'switch', 'catch', '&&', '||'];
    let complexity = 1; // Base complexity
    
    cyclomaticKeywords.forEach(keyword => {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return Math.min(complexity, 20); // Cap at 20
  }
  
  /**
   * Gets current observer status
   */
  getStatus(): {
    enabled: boolean;
    config: ObserverConfig;
    reviewHistory: Array<{ agent: string; history: ReviewHistory }>;
    pendingReviews: string[];
  } {
    return {
      enabled: this.config.enabled,
      config: this.config,
      reviewHistory: Array.from(this.reviewHistory.entries()).map(([agent, history]) => ({
        agent,
        history
      })),
      pendingReviews: Array.from(this.pendingReviews)
    };
  }
}

// Global observer instance
export const agentObserver = new AgentObserver();

/**
 * Hook for components to use the observer
 */
export function useAgentObserver() {
  return {
    observer: agentObserver,
    config: agentObserver.getStatus().config,
    updateConfig: (config: Partial<ObserverConfig>) => agentObserver.updateConfig(config),
    status: agentObserver.getStatus()
  };
}