import { useSelfCritiqueStore } from '../stores/selfCritiqueStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';
import { useFileContext } from '../stores/fileContextStore';
import { checkTokenLimits } from './tokenUsageMonitor';

/**
 * Configuration for Claude's automatic revisit behavior
 */
export interface RevisitConfig {
  enabled: boolean;
  qualityThreshold: number; // Trigger revisit if quality below this
  maxRevisitsPerHour: number; // Rate limiting
  cooldownMinutes: number; // Cooldown between revisits
  riskThreshold: number; // Trigger on high risk scores
  minFileAge: number; // Only revisit files older than this (minutes)
  actions: {
    requestReview: boolean; // Request human review
    triggerRegeneration: boolean; // Trigger automatic regeneration
    flagForRefactoring: boolean; // Flag for manual refactoring
  };
}

export const defaultRevisitConfig: RevisitConfig = {
  enabled: false, // Disabled by default for safety
  qualityThreshold: 4, // Very low quality threshold
  maxRevisitsPerHour: 3, // Very conservative
  cooldownMinutes: 30, // 30 minute cooldown
  riskThreshold: 0.8, // High risk threshold
  minFileAge: 10, // Wait 10 minutes before revisiting
  actions: {
    requestReview: true,
    triggerRegeneration: false, // Disabled by default
    flagForRefactoring: true
  }
};

/**
 * Tracks revisit history for rate limiting
 */
interface RevisitHistory {
  lastRevisitTime: number;
  revisitCount: number;
  hourlyRevisitCount: number;
  lastHourReset: number;
  revisitedFiles: Set<string>; // Track files already revisited
}

class ClaudeRevisitBehavior {
  private config: RevisitConfig = defaultRevisitConfig;
  private revisitHistory: RevisitHistory = {
    lastRevisitTime: 0,
    revisitCount: 0,
    hourlyRevisitCount: 0,
    lastHourReset: Date.now(),
    revisitedFiles: new Set()
  };
  
  /**
   * Updates revisit behavior configuration
   */
  updateConfig(newConfig: Partial<RevisitConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Revisit Behavior',
      message: `Configuration updated: ${this.config.enabled ? 'enabled' : 'disabled'}, threshold: ${this.config.qualityThreshold}/10`
    });
  }
  
  /**
   * Analyzes critiques and triggers appropriate revisit actions
   */
  async analyzeCritiquesAndAct(): Promise<{
    actionsTriggered: number;
    filesProcessed: string[];
    recommendations: string[];
  }> {
    if (!this.config.enabled) {
      return { actionsTriggered: 0, filesProcessed: [], recommendations: [] };
    }
    
    try {
      // Check rate limits
      if (!this.checkRateLimits()) {
        return { actionsTriggered: 0, filesProcessed: [], recommendations: ['Rate limit reached'] };
      }
      
      // Check token limits
      checkTokenLimits();
    } catch (error) {
      return { actionsTriggered: 0, filesProcessed: [], recommendations: ['Token limit exceeded'] };
    }
    
    const critiqueStore = useSelfCritiqueStore.getState();
    const fileStore = useFileContext.getState();
    
    // Get problematic files
    const lowQualityFiles = critiqueStore.getLowQualityFiles(this.config.qualityThreshold);
    const filesNeedingAttention = this.filterEligibleFiles(lowQualityFiles);
    
    if (filesNeedingAttention.length === 0) {
      return { actionsTriggered: 0, filesProcessed: [], recommendations: ['No files need immediate attention'] };
    }
    
    const actionsTriggered: string[] = [];
    const filesProcessed: string[] = [];
    const recommendations: string[] = [];
    
    // Process each problematic file
    for (const critique of filesNeedingAttention.slice(0, 3)) { // Limit to 3 files per session
      const fileInsights = critiqueStore.getFileInsights(critique.filePath);
      const actionsTaken = await this.processProblematicFile(critique, fileInsights);
      
      if (actionsTaken.length > 0) {
        actionsTriggered.push(...actionsTaken);
        filesProcessed.push(critique.filePath);
        this.revisitHistory.revisitedFiles.add(critique.filePath);
      }
    }
    
    // Update rate limiting
    if (actionsTriggered.length > 0) {
      this.updateRevisitHistory();
    }
    
    // Generate recommendations
    if (filesNeedingAttention.length > filesProcessed.length) {
      recommendations.push(`${filesNeedingAttention.length - filesProcessed.length} additional files need attention`);
    }
    
    // Log activity
    if (actionsTriggered.length > 0) {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Revisit Behavior',
        message: `🔄 Triggered ${actionsTriggered.length} revisit actions for ${filesProcessed.length} files`
      });
    }
    
    return {
      actionsTriggered: actionsTriggered.length,
      filesProcessed,
      recommendations
    };
  }
  
  /**
   * Filters files that are eligible for revisit actions
   */
  private filterEligibleFiles(critiques: any[]): any[] {
    const now = Date.now();
    const minAgeMs = this.config.minFileAge * 60 * 1000;
    
    return critiques.filter(critique => {
      // Skip if file was already revisited
      if (this.revisitHistory.revisitedFiles.has(critique.filePath)) {
        return false;
      }
      
      // Skip if file is too new
      if (now - critique.timestamp < minAgeMs) {
        return false;
      }
      
      // Check quality threshold
      if (critique.quality >= this.config.qualityThreshold) {
        return false;
      }
      
      // Check risk threshold
      const fileInsights = useSelfCritiqueStore.getState().getFileInsights(critique.filePath);
      if (fileInsights.riskScore < this.config.riskThreshold) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Processes a single problematic file and triggers appropriate actions
   */
  private async processProblematicFile(critique: any, fileInsights: any): Promise<string[]> {
    const actions: string[] = [];
    const messageBus = useMessageBus.getState();
    
    try {
      // Determine severity level
      const severity = this.calculateSeverity(critique, fileInsights);
      
      // Request human review for critical issues
      if (this.config.actions.requestReview && severity >= 3) {
        messageBus.sendMessage(MessagePatterns.log(
          'CLAUDE_REVISIT',
          `🚨 Critical quality issue detected in ${critique.filePath} (${critique.quality}/10). Human review recommended.`,
          ['critical', 'review-needed', 'quality-issue']
        ));
        
        messageBus.sendMessage({
          sender: 'CLAUDE_REVISIT',
          receiver: 'USER',
          type: 'request',
          content: `Quality Alert: ${critique.filePath} has received a ${critique.quality}/10 quality score. Issues: ${critique.reasons.slice(0, 2).join(', ')}. Please review when possible.`,
          priority: 'high',
          metadata: {
            tags: ['quality-alert', 'human-review-needed'],
            filePath: critique.filePath,
            qualityScore: critique.quality,
            riskScore: fileInsights.riskScore,
            issues: critique.reasons
          }
        });
        
        actions.push('human-review-requested');
      }
      
      // Flag for refactoring
      if (this.config.actions.flagForRefactoring && severity >= 2) {
        messageBus.sendMessage({
          sender: 'CLAUDE_REVISIT',
          receiver: 'ALL',
          type: 'task',
          content: `Refactoring Recommended: ${critique.filePath} - Quality: ${critique.quality}/10, Risk: ${Math.round(fileInsights.riskScore * 100)}%. Suggestions: ${fileInsights.improvementSuggestions.slice(0, 2).join(', ')}`,
          priority: 'medium',
          metadata: {
            tags: ['refactoring-needed', 'quality-improvement'],
            filePath: critique.filePath,
            suggestions: fileInsights.improvementSuggestions,
            actionType: 'refactor'
          }
        });
        
        actions.push('refactoring-flagged');
      }
      
      // Trigger regeneration (only for non-critical files to avoid breaking changes)
      if (this.config.actions.triggerRegeneration && severity === 1 && critique.quality < 3) {
        messageBus.sendMessage({
          sender: 'CLAUDE_REVISIT',
          receiver: 'UI_AGENT',
          type: 'regenerate',
          content: `Auto-regeneration triggered for ${critique.filePath} due to very low quality (${critique.quality}/10). Focus areas: ${critique.reasons.slice(0, 2).join(', ')}`,
          priority: 'medium',
          metadata: {
            tags: ['auto-regeneration', 'quality-improvement'],
            filePath: critique.filePath,
            target: critique.filePath,
            focusAreas: critique.reasons,
            originalQuality: critique.quality
          }
        });
        
        actions.push('regeneration-triggered');
      }
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Claude Revisit Behavior',
        message: `Failed to process ${critique.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    return actions;
  }
  
  /**
   * Calculates severity level for a file based on quality and risk
   */
  private calculateSeverity(critique: any, fileInsights: any): number {
    let severity = 0;
    
    // Quality-based severity
    if (critique.quality <= 2) severity += 3; // Critical
    else if (critique.quality <= 4) severity += 2; // High
    else if (critique.quality <= 6) severity += 1; // Medium
    
    // Risk-based severity
    if (fileInsights.riskScore >= 0.9) severity += 2;
    else if (fileInsights.riskScore >= 0.7) severity += 1;
    
    // Issue count based severity
    if (critique.reasons.length >= 5) severity += 1;
    
    // File age factor (older low-quality files are more concerning)
    const ageHours = (Date.now() - critique.timestamp) / (1000 * 60 * 60);
    if (ageHours > 24) severity += 1;
    
    return Math.min(severity, 5); // Cap at 5
  }
  
  /**
   * Checks rate limits for revisit actions
   */
  private checkRateLimits(): boolean {
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.revisitHistory.lastHourReset > 60 * 60 * 1000) {
      this.revisitHistory.hourlyRevisitCount = 0;
      this.revisitHistory.lastHourReset = now;
      this.revisitHistory.revisitedFiles.clear(); // Reset revisited files hourly
    }
    
    // Check hourly limit
    if (this.revisitHistory.hourlyRevisitCount >= this.config.maxRevisitsPerHour) {
      return false;
    }
    
    // Check cooldown
    const timeSinceLastRevisit = now - this.revisitHistory.lastRevisitTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    return timeSinceLastRevisit >= cooldownMs;
  }
  
  /**
   * Updates revisit history for rate limiting
   */
  private updateRevisitHistory() {
    const now = Date.now();
    this.revisitHistory.lastRevisitTime = now;
    this.revisitHistory.revisitCount++;
    this.revisitHistory.hourlyRevisitCount++;
  }
  
  /**
   * Gets current revisit behavior status
   */
  getStatus(): {
    config: RevisitConfig;
    history: Omit<RevisitHistory, 'revisitedFiles'> & { revisitedFilesCount: number };
    canRevisit: boolean;
    nextAllowedTime: number;
  } {
    const canRevisit = this.config.enabled && this.checkRateLimits();
    const nextAllowedTime = this.revisitHistory.lastRevisitTime + 
      (this.config.cooldownMinutes * 60 * 1000);
    
    return {
      config: this.config,
      history: {
        lastRevisitTime: this.revisitHistory.lastRevisitTime,
        revisitCount: this.revisitHistory.revisitCount,
        hourlyRevisitCount: this.revisitHistory.hourlyRevisitCount,
        lastHourReset: this.revisitHistory.lastHourReset,
        revisitedFilesCount: this.revisitHistory.revisitedFiles.size
      },
      canRevisit,
      nextAllowedTime
    };
  }
  
  /**
   * Manually trigger revisit analysis
   */
  async triggerManualRevisit(): Promise<any> {
    return await this.analyzeCritiquesAndAct();
  }
  
  /**
   * Reset revisited files tracking
   */
  resetRevisitedFiles() {
    this.revisitHistory.revisitedFiles.clear();
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Revisit Behavior',
      message: 'Revisited files tracking reset'
    });
  }
}

// Global revisit behavior instance
export const claudeRevisitBehavior = new ClaudeRevisitBehavior();

/**
 * Hook for components to use revisit behavior
 */
export function useRevisitBehavior() {
  return {
    behavior: claudeRevisitBehavior,
    triggerAnalysis: () => claudeRevisitBehavior.triggerManualRevisit(),
    updateConfig: (config: Partial<RevisitConfig>) => claudeRevisitBehavior.updateConfig(config),
    getStatus: () => claudeRevisitBehavior.getStatus(),
    resetTracking: () => claudeRevisitBehavior.resetRevisitedFiles()
  };
}