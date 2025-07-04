import { useAgentFeedbackStore } from '../stores/agentFeedbackStore';
import { useMemoryStore } from '../stores/memoryStore';
import { useLogStore } from '../stores/logStore';
import { checkTokenLimits } from './tokenUsageMonitor';
import { AgentFeedback, FeedbackSummary } from '../types';

/**
 * Configuration for Claude planning enhancement
 */
export interface PlanningEnhancerConfig {
  enabled: boolean;
  maxPlanningCallsPerHour: number; // Strict limit to prevent token burns
  minFeedbacksForAnalysis: number; // Minimum feedbacks needed before enhancement
  qualityThreshold: number; // Only use feedback above this quality score
  maxContextTokens: number; // Maximum tokens to use for context
  cooldownMinutes: number; // Cooldown between planning enhancements
}

export const defaultPlanningConfig: PlanningEnhancerConfig = {
  enabled: false, // Disabled by default for safety
  maxPlanningCallsPerHour: 5, // Very strict limit
  minFeedbacksForAnalysis: 10, // Need at least 10 feedbacks
  qualityThreshold: 0.6, // Only use quality feedback
  maxContextTokens: 2000, // Conservative token limit
  cooldownMinutes: 30 // 30 minute cooldown
};

/**
 * Enhanced planning insights based on agent feedback
 */
export interface PlanningInsights {
  agentStrengths: Record<string, string[]>; // What each agent does well
  agentWeaknesses: Record<string, string[]>; // What each agent struggles with
  commonPatterns: string[]; // Common issues across agents
  recommendedPairings: Array<{ agent1: string; agent2: string; reason: string }>; // Suggested collaborations
  qualityTrends: Record<string, 'improving' | 'stable' | 'declining'>;
  securityConcerns: string[]; // Security-related feedback
  performanceIssues: string[]; // Performance-related feedback
  bestPractices: string[]; // Best practices learned from feedback
  tokenUsageEstimate: number; // Estimated tokens if sent to Claude
}

/**
 * Planning enhancement history for rate limiting
 */
interface PlanningHistory {
  lastEnhancementTime: number;
  enhancementCount: number;
  hourlyEnhancementCount: number;
  lastHourReset: number;
}

class ClaudePlanningEnhancer {
  private config: PlanningEnhancerConfig = defaultPlanningConfig;
  private planningHistory: PlanningHistory = {
    lastEnhancementTime: 0,
    enhancementCount: 0,
    hourlyEnhancementCount: 0,
    lastHourReset: Date.now()
  };
  
  /**
   * Updates planning enhancer configuration
   */
  updateConfig(newConfig: Partial<PlanningEnhancerConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Planning Enhancer',
      message: `Configuration updated: ${this.config.enabled ? 'enabled' : 'disabled'}, max ${this.config.maxPlanningCallsPerHour} calls/hour`
    });
  }
  
  /**
   * Generates planning insights from agent feedback (without API calls)
   */
  generatePlanningInsights(): PlanningInsights {
    const feedbackStore = useAgentFeedbackStore.getState();
    const allFeedbacks = feedbackStore.getRecentFeedbacks(200); // Analyze recent feedbacks
    
    // Filter quality feedback
    const qualityFeedbacks = allFeedbacks.filter(
      f => f.qualityScore >= this.config.qualityThreshold
    );
    
    const insights: PlanningInsights = {
      agentStrengths: {},
      agentWeaknesses: {},
      commonPatterns: [],
      recommendedPairings: [],
      qualityTrends: {},
      securityConcerns: [],
      performanceIssues: [],
      bestPractices: [],
      tokenUsageEstimate: 0
    };
    
    // Get unique agents
    const agents = Array.from(new Set(qualityFeedbacks.map(f => f.agent)));
    
    // Analyze each agent
    agents.forEach(agent => {
      const agentFeedbacks = qualityFeedbacks.filter(f => f.agent === agent);
      const summary = feedbackStore.getFeedbackSummary(agent);
      
      // Determine strengths and weaknesses
      insights.agentStrengths[agent] = this.extractStrengths(agentFeedbacks);
      insights.agentWeaknesses[agent] = this.extractWeaknesses(agentFeedbacks);
      
      // Quality trends
      insights.qualityTrends[agent] = summary.recentTrends.improving ? 'improving' : 
        summary.recentTrends.scoreChange < -0.1 ? 'declining' : 'stable';
    });
    
    // Common patterns analysis
    insights.commonPatterns = this.findCommonPatterns(qualityFeedbacks);
    
    // Security and performance concerns
    insights.securityConcerns = this.extractSecurityConcerns(qualityFeedbacks);
    insights.performanceIssues = this.extractPerformanceIssues(qualityFeedbacks);
    
    // Best practices
    insights.bestPractices = this.extractBestPractices(qualityFeedbacks);
    
    // Recommended pairings
    insights.recommendedPairings = this.generateRecommendedPairings(agents, insights);
    
    // Estimate token usage if we were to send this to Claude
    insights.tokenUsageEstimate = this.estimateTokenUsage(insights);
    
    return insights;
  }
  
  /**
   * Extracts agent strengths from feedback
   */
  private extractStrengths(feedbacks: AgentFeedback[]): string[] {
    const strengths = new Set<string>();
    
    feedbacks.forEach(feedback => {
      if (feedback.qualityScore >= 0.8) {
        // High quality work indicates strength
        if (feedback.category === 'code_quality') {
          strengths.add('Clean code architecture');
        } else if (feedback.category === 'performance') {
          strengths.add('Performance optimization');
        } else if (feedback.category === 'security') {
          strengths.add('Security best practices');
        } else if (feedback.category === 'style') {
          strengths.add('Code style consistency');
        } else if (feedback.category === 'maintainability') {
          strengths.add('Maintainable code structure');
        }
      }
    });
    
    return Array.from(strengths);
  }
  
  /**
   * Extracts agent weaknesses from feedback
   */
  private extractWeaknesses(feedbacks: AgentFeedback[]): string[] {
    const weaknesses = new Set<string>();
    
    feedbacks.forEach(feedback => {
      if (feedback.qualityScore < 0.6 && feedback.severity === 'high') {
        // Low quality + high severity indicates weakness
        if (feedback.category === 'code_quality') {
          weaknesses.add('Code quality issues');
        } else if (feedback.category === 'performance') {
          weaknesses.add('Performance bottlenecks');
        } else if (feedback.category === 'security') {
          weaknesses.add('Security vulnerabilities');
        } else if (feedback.category === 'style') {
          weaknesses.add('Inconsistent code style');
        } else if (feedback.category === 'maintainability') {
          weaknesses.add('Complex or hard-to-maintain code');
        }
      }
    });
    
    return Array.from(weaknesses);
  }
  
  /**
   * Finds common patterns across all agents
   */
  private findCommonPatterns(feedbacks: AgentFeedback[]): string[] {
    const patterns = new Map<string, number>();
    
    feedbacks.forEach(feedback => {
      // Look for common issues in feedback text
      if (feedback.feedback.toLowerCase().includes('error handling')) {
        patterns.set('Missing error handling', (patterns.get('Missing error handling') || 0) + 1);
      }
      if (feedback.feedback.toLowerCase().includes('type')) {
        patterns.set('TypeScript type issues', (patterns.get('TypeScript type issues') || 0) + 1);
      }
      if (feedback.feedback.toLowerCase().includes('performance')) {
        patterns.set('Performance concerns', (patterns.get('Performance concerns') || 0) + 1);
      }
      if (feedback.feedback.toLowerCase().includes('security')) {
        patterns.set('Security considerations', (patterns.get('Security considerations') || 0) + 1);
      }
      if (feedback.feedback.toLowerCase().includes('test')) {
        patterns.set('Testing gaps', (patterns.get('Testing gaps') || 0) + 1);
      }
    });
    
    // Return patterns that appear in at least 3 feedbacks
    return Array.from(patterns.entries())
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .map(([pattern]) => pattern);
  }
  
  /**
   * Extracts security concerns from feedback
   */
  private extractSecurityConcerns(feedbacks: AgentFeedback[]): string[] {
    const concerns = new Set<string>();
    
    feedbacks
      .filter(f => f.category === 'security')
      .forEach(feedback => {
        if (feedback.feedback.toLowerCase().includes('password')) {
          concerns.add('Password handling issues');
        }
        if (feedback.feedback.toLowerCase().includes('injection')) {
          concerns.add('Injection vulnerability risks');
        }
        if (feedback.feedback.toLowerCase().includes('xss')) {
          concerns.add('XSS prevention needed');
        }
        if (feedback.feedback.toLowerCase().includes('token')) {
          concerns.add('Token security concerns');
        }
        if (feedback.feedback.toLowerCase().includes('validation')) {
          concerns.add('Input validation missing');
        }
      });
    
    return Array.from(concerns);
  }
  
  /**
   * Extracts performance issues from feedback
   */
  private extractPerformanceIssues(feedbacks: AgentFeedback[]): string[] {
    const issues = new Set<string>();
    
    feedbacks
      .filter(f => f.category === 'performance')
      .forEach(feedback => {
        if (feedback.feedback.toLowerCase().includes('memory')) {
          issues.add('Memory usage optimization needed');
        }
        if (feedback.feedback.toLowerCase().includes('loop')) {
          issues.add('Inefficient loops detected');
        }
        if (feedback.feedback.toLowerCase().includes('database')) {
          issues.add('Database query optimization needed');
        }
        if (feedback.feedback.toLowerCase().includes('render')) {
          issues.add('Rendering performance issues');
        }
      });
    
    return Array.from(issues);
  }
  
  /**
   * Extracts best practices from high-quality feedback
   */
  private extractBestPractices(feedbacks: AgentFeedback[]): string[] {
    const practices = new Set<string>();
    
    feedbacks
      .filter(f => f.qualityScore >= 0.8)
      .forEach(feedback => {
        if (feedback.suggestions) {
          feedback.suggestions.forEach(suggestion => {
            if (suggestion.toLowerCase().includes('typescript')) {
              practices.add('Use TypeScript for better type safety');
            }
            if (suggestion.toLowerCase().includes('async')) {
              practices.add('Proper async/await error handling');
            }
            if (suggestion.toLowerCase().includes('component')) {
              practices.add('Component modularity and reusability');
            }
            if (suggestion.toLowerCase().includes('test')) {
              practices.add('Comprehensive testing strategies');
            }
          });
        }
      });
    
    return Array.from(practices);
  }
  
  /**
   * Generates recommended agent pairings based on complementary strengths
   */
  private generateRecommendedPairings(
    agents: string[], 
    insights: PlanningInsights
  ): Array<{ agent1: string; agent2: string; reason: string }> {
    const pairings: Array<{ agent1: string; agent2: string; reason: string }> = [];
    
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const agent1 = agents[i];
        const agent2 = agents[j];
        
        const strengths1 = insights.agentStrengths[agent1] || [];
        const strengths2 = insights.agentStrengths[agent2] || [];
        const weaknesses1 = insights.agentWeaknesses[agent1] || [];
        const weaknesses2 = insights.agentWeaknesses[agent2] || [];
        
        // Check if agent1's strengths cover agent2's weaknesses
        const complementary1 = weaknesses2.some(weakness => 
          strengths1.some(strength => this.isComplementary(weakness, strength))
        );
        
        // Check if agent2's strengths cover agent1's weaknesses
        const complementary2 = weaknesses1.some(weakness => 
          strengths2.some(strength => this.isComplementary(weakness, strength))
        );
        
        if (complementary1 || complementary2) {
          pairings.push({
            agent1,
            agent2,
            reason: `Complementary skills: ${agent1} and ${agent2} can cover each other's weaknesses`
          });
        }
      }
    }
    
    return pairings.slice(0, 3); // Limit to top 3 recommendations
  }
  
  /**
   * Checks if a strength is complementary to a weakness
   */
  private isComplementary(weakness: string, strength: string): boolean {
    const complementaryMap: Record<string, string[]> = {
      'Code quality issues': ['Clean code architecture', 'Code style consistency'],
      'Performance bottlenecks': ['Performance optimization'],
      'Security vulnerabilities': ['Security best practices'],
      'Complex or hard-to-maintain code': ['Maintainable code structure']
    };
    
    return complementaryMap[weakness]?.includes(strength) || false;
  }
  
  /**
   * Estimates token usage for sending insights to Claude
   */
  private estimateTokenUsage(insights: PlanningInsights): number {
    // Rough estimation: 1 token per 4 characters
    const insightsJson = JSON.stringify(insights);
    return Math.ceil(insightsJson.length / 4);
  }
  
  /**
   * Checks if planning enhancement is allowed (rate limiting)
   */
  private canEnhancePlanning(): boolean {
    if (!this.config.enabled) return false;
    
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.planningHistory.lastHourReset > 60 * 60 * 1000) {
      this.planningHistory.hourlyEnhancementCount = 0;
      this.planningHistory.lastHourReset = now;
    }
    
    // Check hourly limit
    if (this.planningHistory.hourlyEnhancementCount >= this.config.maxPlanningCallsPerHour) {
      return false;
    }
    
    // Check cooldown
    const timeSinceLastEnhancement = now - this.planningHistory.lastEnhancementTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    if (timeSinceLastEnhancement < cooldownMs) {
      return false;
    }
    
    // Check minimum feedback requirement
    const feedbackCount = useAgentFeedbackStore.getState().getRecentFeedbacks(100).length;
    if (feedbackCount < this.config.minFeedbacksForAnalysis) {
      return false;
    }
    
    // Check token limits
    try {
      checkTokenLimits();
    } catch (error) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Gets enhanced planning context for Claude (if token budget allows)
   */
  async getEnhancedPlanningContext(): Promise<{
    insights: PlanningInsights;
    contextSummary: string;
    tokenSafe: boolean;
  }> {
    const insights = this.generatePlanningInsights();
    
    // Check if we can safely use these insights
    const tokenSafe = insights.tokenUsageEstimate <= this.config.maxContextTokens;
    
    if (!tokenSafe) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Planning Enhancer',
        message: `Planning context too large (${insights.tokenUsageEstimate} tokens), using summary only`
      });
    }
    
    // Generate a concise summary for token safety
    const contextSummary = this.generateContextSummary(insights);
    
    // Update planning history if we're providing context
    if (this.canEnhancePlanning()) {
      this.planningHistory.lastEnhancementTime = Date.now();
      this.planningHistory.enhancementCount++;
      this.planningHistory.hourlyEnhancementCount++;
    }
    
    return {
      insights,
      contextSummary,
      tokenSafe
    };
  }
  
  /**
   * Generates a concise summary of planning insights
   */
  private generateContextSummary(insights: PlanningInsights): string {
    const summary = [];
    
    // Common patterns
    if (insights.commonPatterns.length > 0) {
      summary.push(`Common issues: ${insights.commonPatterns.slice(0, 3).join(', ')}`);
    }
    
    // Security concerns
    if (insights.securityConcerns.length > 0) {
      summary.push(`Security focus needed: ${insights.securityConcerns.slice(0, 2).join(', ')}`);
    }
    
    // Performance issues
    if (insights.performanceIssues.length > 0) {
      summary.push(`Performance attention: ${insights.performanceIssues.slice(0, 2).join(', ')}`);
    }
    
    // Agent quality trends
    const decliningAgents = Object.entries(insights.qualityTrends)
      .filter(([, trend]) => trend === 'declining')
      .map(([agent]) => agent);
    
    if (decliningAgents.length > 0) {
      summary.push(`Quality declining: ${decliningAgents.slice(0, 2).join(', ')}`);
    }
    
    // Best practices
    if (insights.bestPractices.length > 0) {
      summary.push(`Best practices: ${insights.bestPractices.slice(0, 2).join(', ')}`);
    }
    
    return summary.join(' | ');
  }
  
  /**
   * Gets current enhancer status
   */
  getStatus(): {
    config: PlanningEnhancerConfig;
    history: PlanningHistory;
    canEnhance: boolean;
    nextAllowedTime: number;
  } {
    const canEnhance = this.canEnhancePlanning();
    const nextAllowedTime = this.planningHistory.lastEnhancementTime + 
      (this.config.cooldownMinutes * 60 * 1000);
    
    return {
      config: this.config,
      history: this.planningHistory,
      canEnhance,
      nextAllowedTime
    };
  }
}

// Global planning enhancer instance
export const claudePlanningEnhancer = new ClaudePlanningEnhancer();

/**
 * Hook for components to use the planning enhancer
 */
export function usePlanningEnhancer() {
  return {
    enhancer: claudePlanningEnhancer,
    generateInsights: () => claudePlanningEnhancer.generatePlanningInsights(),
    getEnhancedContext: () => claudePlanningEnhancer.getEnhancedPlanningContext(),
    updateConfig: (config: Partial<PlanningEnhancerConfig>) => 
      claudePlanningEnhancer.updateConfig(config),
    status: claudePlanningEnhancer.getStatus()
  };
}