import { useFileContext, FileRecord } from '../stores/fileContextStore';
import { useLogStore } from '../stores/logStore';
import { useMemoryStore } from '../stores/memoryStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { callClaudeWithContext } from '../utils/claudeApi';
import { checkTokenLimits } from '../utils/tokenUsageMonitor';
import { useTokenBudgetStore } from '../stores/tokenBudgetStore';

/**
 * Configuration for Claude self-critique system
 */
export interface SelfCritiqueConfig {
  enabled: boolean;
  maxCritiquesPerHour: number; // Rate limiting for token safety
  qualityThreshold: number; // Only critique files with potential issues
  maxFileSize: number; // Skip very large files
  cooldownMinutes: number; // Cooldown between critiques
  batchSize: number; // Max files to critique at once
  excludeFileTypes: string[]; // File types to skip
  focusAreas: string[]; // Areas to focus critique on
}

export const defaultCritiqueConfig: SelfCritiqueConfig = {
  enabled: false, // Disabled by default for safety
  maxCritiquesPerHour: 5, // Very conservative limit
  qualityThreshold: 0.7, // Only critique potentially problematic files
  maxFileSize: 2000, // Skip files larger than 2KB
  cooldownMinutes: 20, // 20 minute cooldown
  batchSize: 3, // Max 3 files at once
  excludeFileTypes: ['.md', '.json', '.css', '.png', '.jpg'],
  focusAreas: ['code_quality', 'maintainability', 'performance', 'security', 'best_practices']
};

/**
 * Critique entry structure
 */
export interface CritiqueEntry {
  id: string;
  filePath: string;
  quality: number; // 1-10 scale
  reasons: string[];
  suggestions: string[];
  focusArea: string;
  confidence: number; // Claude's confidence in the critique
  timestamp: number;
  fileSize: number;
  language: string;
  metadata: {
    critiquedBy: 'CLAUDE_SELF_CRITIQUE';
    analysisTime: number;
    tokenUsage: number;
    version: string;
  };
}

/**
 * Critique analysis result
 */
export interface CritiqueAnalysis {
  overallQuality: number;
  critiques: CritiqueEntry[];
  commonIssues: string[];
  recommendations: string[];
  improvementTrends: {
    improving: boolean;
    scoreChange: number;
  };
  tokenUsage: number;
}

/**
 * Rate limiting for critique operations
 */
interface CritiqueHistory {
  lastCritiqueTime: number;
  critiqueCount: number;
  hourlyCritiqueCount: number;
  lastHourReset: number;
}

class ClaudeCritiqueEngine {
  private config: SelfCritiqueConfig = defaultCritiqueConfig;
  private critiqueHistory: CritiqueHistory = {
    lastCritiqueTime: 0,
    critiqueCount: 0,
    hourlyCritiqueCount: 0,
    lastHourReset: Date.now()
  };
  
  /**
   * Updates critique engine configuration
   */
  updateConfig(newConfig: Partial<SelfCritiqueConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Critique Engine',
      message: `Configuration updated: ${this.config.enabled ? 'enabled' : 'disabled'}, max ${this.config.maxCritiquesPerHour} critiques/hour`
    });
  }
  
  /**
   * Analyzes files and generates self-critiques
   */
  async analyzeAndCritique(targetFiles?: string[]): Promise<CritiqueAnalysis> {
    if (!this.config.enabled) {
      throw new Error('Critique engine is disabled');
    }

    // Check token budget and degradation level
    const tokenBudget = useTokenBudgetStore.getState();
    if (!tokenBudget.isCriticAllowed()) {
      const analytics = tokenBudget.getAnalytics();
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Critique Engine',
        message: `🚫 Critique blocked by token budget system (${Math.round(analytics.usagePercentage * 100)}% daily usage)`
      });
      throw new Error(`Critique operations disabled due to token budget constraints (${analytics.status} level)`);
    }
    
    // Check rate limits
    if (!this.checkRateLimits()) {
      throw new Error('Rate limit exceeded for critiques');
    }
    
    // Estimate token usage for this operation
    const estimatedTokens = this.estimateCritiqueTokens(targetFiles?.length || 3);
    const operationResult = tokenBudget.checkOperationAllowed(estimatedTokens, 'auto_critique');
    
    if (!operationResult.allowed) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Critique Engine',
        message: `🚫 Critique operation blocked: ${operationResult.reason}`
      });
      throw new Error(operationResult.reason);
    }

    // Log degradation status if applicable
    if (operationResult.degradationLevel !== 'none') {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Critique Engine',
        message: `⚠️ Operating under ${operationResult.degradationLevel} degradation mode`
      });
    }
    
    const startTime = Date.now();
    let totalTokenUsage = 0;
    
    try {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Critique Engine',
        message: '🔍 Starting self-critique analysis...'
      });
      
      // Get files to critique
      const filesToCritique = this.selectFilesForCritique(targetFiles);
      
      if (filesToCritique.length === 0) {
        return {
          overallQuality: 0,
          critiques: [],
          commonIssues: [],
          recommendations: ['No files available for critique'],
          improvementTrends: { improving: false, scoreChange: 0 },
          tokenUsage: 0
        };
      }
      
      // Generate critiques for each file
      const critiques: CritiqueEntry[] = [];
      
      for (const file of filesToCritique.slice(0, this.config.batchSize)) {
        try {
          const critique = await this.critiqueFile(file);
          if (critique) {
            critiques.push(critique);
            totalTokenUsage += critique.metadata.tokenUsage;
          }
        } catch (error) {
          useLogStore.getState().addLog({
            level: 'warn',
            source: 'Claude Critique Engine',
            message: `Failed to critique ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
      
      // Analyze overall patterns
      const analysis = this.analyzeOverallPatterns(critiques);
      
      // Update rate limiting
      this.updateCritiqueHistory();

      // Track token usage in budget system
      tokenBudget.trackUsage(totalTokenUsage * 0.3, totalTokenUsage * 0.7); // Estimate 30% input, 70% output
      
      useLogStore.getState().addLog({
        level: 'success',
        source: 'Claude Critique Engine',
        message: `✅ Completed critique analysis: ${critiques.length} files analyzed, avg quality: ${Math.round(analysis.overallQuality * 10)}/10, ${totalTokenUsage} tokens used`
      });
      
      // Send notification
      useMessageBus.getState().sendMessage(MessagePatterns.log(
        'CLAUDE_CRITIQUE',
        `Self-critique completed: ${critiques.length} files analyzed (${totalTokenUsage} tokens)`,
        ['critique', 'self-analysis', 'quality-assessment', 'token-usage']
      ));
      
      return {
        ...analysis,
        critiques,
        tokenUsage: totalTokenUsage
      };
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Claude Critique Engine',
        message: `Critique analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }
  
  /**
   * Selects files for critique based on criteria
   */
  private selectFilesForCritique(targetFiles?: string[]): FileRecord[] {
    const { getAllFiles } = useFileContext.getState();
    const allFiles = Object.values(getAllFiles());
    
    let candidateFiles: FileRecord[];
    
    if (targetFiles && targetFiles.length > 0) {
      // Use specific target files
      candidateFiles = allFiles.filter(file => targetFiles.includes(file.path));
    } else {
      // Auto-select files based on criteria
      candidateFiles = allFiles.filter(file => this.shouldCritiqueFile(file));
    }
    
    // Sort by recency and potential issues
    return candidateFiles
      .sort((a, b) => {
        // Prioritize recently modified files
        const timeScore = b.timestamp - a.timestamp;
        
        // Prioritize files that might have issues (heuristics)
        const aIssueScore = this.calculateIssueScore(a);
        const bIssueScore = this.calculateIssueScore(b);
        
        return (bIssueScore - aIssueScore) + (timeScore / 1000000); // Weight time less
      });
  }
  
  /**
   * Determines if a file should be critiqued
   */
  private shouldCritiqueFile(file: FileRecord): boolean {
    // Skip if file is too large
    if (file.size > this.config.maxFileSize) {
      return false;
    }
    
    // Skip excluded file types
    const extension = file.path.split('.').pop()?.toLowerCase();
    if (extension && this.config.excludeFileTypes.includes(`.${extension}`)) {
      return false;
    }
    
    // Only critique code files
    const codeLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust'];
    if (!file.language || !codeLanguages.includes(file.language)) {
      return false;
    }
    
    // Skip very small files
    if (file.size < 100) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculates a heuristic issue score for file prioritization
   */
  private calculateIssueScore(file: FileRecord): number {
    let score = 0;
    const content = file.content.toLowerCase();
    
    // Check for potential issues
    if (content.includes('todo') || content.includes('fixme')) score += 2;
    if (content.includes('hack') || content.includes('temp')) score += 3;
    if (content.includes('any') && file.language === 'typescript') score += 1;
    if (content.includes('console.log')) score += 1;
    if (!content.includes('function') && !content.includes('const') && file.size > 200) score += 1;
    
    // Check complexity indicators
    const lineCount = file.lineCount || file.content.split('\n').length;
    if (lineCount > 100) score += 1;
    if (lineCount > 300) score += 2;
    
    return score;
  }
  
  /**
   * Critiques a single file using Claude
   */
  private async critiqueFile(file: FileRecord): Promise<CritiqueEntry | null> {
    const startTime = Date.now();
    
    const prompt = `As an expert code reviewer, analyze this ${file.language} file and provide a structured critique.

FILE: ${file.path}
SIZE: ${file.size} characters, ${file.lineCount} lines
LANGUAGE: ${file.language}

CODE:
\`\`\`${file.language}
${file.content}
\`\`\`

Analyze the code focusing on these areas:
${this.config.focusAreas.map(area => `- ${area.replace('_', ' ')}`).join('\n')}

Provide your response in this EXACT JSON format:
{
  "quality": 7.5,
  "focusArea": "code_quality",
  "reasons": [
    "Good separation of concerns",
    "Missing error handling in async functions",
    "Variable names could be more descriptive"
  ],
  "suggestions": [
    "Add try-catch blocks around async operations",
    "Rename variables like 'data' to be more specific",
    "Consider extracting large functions into smaller ones"
  ],
  "confidence": 0.85
}

Rate quality from 1-10 where:
- 1-3: Poor (major issues, hard to maintain)
- 4-6: Average (some issues, room for improvement)  
- 7-8: Good (minor issues, mostly well-written)
- 9-10: Excellent (very clean, well-structured)

IMPORTANT: Return ONLY the JSON, no markdown or extra text.`;

    try {
      const response = await callClaudeWithContext(prompt, [], {
        includeMemory: false,
        includeFiles: false,
        includeProjectState: false,
        includeTaskMemory: false
      });
      
      const critiqueData = JSON.parse(response);
      const analysisTime = Date.now() - startTime;
      
      // Estimate token usage (rough calculation)
      const tokenUsage = Math.ceil((prompt.length + response.length) / 4);
      
      const critique: CritiqueEntry = {
        id: crypto.randomUUID(),
        filePath: file.path,
        quality: Math.max(1, Math.min(10, critiqueData.quality || 5)),
        reasons: critiqueData.reasons || [],
        suggestions: critiqueData.suggestions || [],
        focusArea: critiqueData.focusArea || 'code_quality',
        confidence: Math.max(0, Math.min(1, critiqueData.confidence || 0.5)),
        timestamp: Date.now(),
        fileSize: file.size,
        language: file.language || 'unknown',
        metadata: {
          critiquedBy: 'CLAUDE_SELF_CRITIQUE',
          analysisTime,
          tokenUsage,
          version: '1.0'
        }
      };
      
      return critique;
      
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Claude Critique Engine',
        message: `Failed to critique ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return null;
    }
  }
  
  /**
   * Analyzes overall patterns in critiques
   */
  private analyzeOverallPatterns(critiques: CritiqueEntry[]): {
    overallQuality: number;
    commonIssues: string[];
    recommendations: string[];
    improvementTrends: { improving: boolean; scoreChange: number };
  } {
    if (critiques.length === 0) {
      return {
        overallQuality: 0,
        commonIssues: [],
        recommendations: [],
        improvementTrends: { improving: false, scoreChange: 0 }
      };
    }
    
    // Calculate overall quality
    const totalQuality = critiques.reduce((sum, c) => sum + c.quality, 0);
    const overallQuality = totalQuality / critiques.length / 10; // Normalize to 0-1
    
    // Find common issues
    const allReasons = critiques.flatMap(c => c.reasons);
    const reasonCounts = allReasons.reduce((acc, reason) => {
      const key = reason.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const commonIssues = Object.entries(reasonCounts)
      .filter(([, count]) => count >= 2) // Issues appearing in 2+ files
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason]) => reason);
    
    // Generate recommendations
    const allSuggestions = critiques.flatMap(c => c.suggestions);
    const uniqueSuggestions = Array.from(new Set(allSuggestions));
    const recommendations = uniqueSuggestions.slice(0, 5);
    
    // Calculate improvement trends (simplified)
    const avgQuality = critiques.reduce((sum, c) => sum + c.quality, 0) / critiques.length;
    const improvementTrends = {
      improving: avgQuality >= 7, // Simple heuristic
      scoreChange: avgQuality - 6 // Compare to baseline of 6
    };
    
    return {
      overallQuality,
      commonIssues,
      recommendations,
      improvementTrends
    };
  }
  
  /**
   * Checks rate limits for critique operations
   */
  private checkRateLimits(): boolean {
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.critiqueHistory.lastHourReset > 60 * 60 * 1000) {
      this.critiqueHistory.hourlyCritiqueCount = 0;
      this.critiqueHistory.lastHourReset = now;
    }
    
    // Check hourly limit
    if (this.critiqueHistory.hourlyCritiqueCount >= this.config.maxCritiquesPerHour) {
      return false;
    }
    
    // Check cooldown
    const timeSinceLastCritique = now - this.critiqueHistory.lastCritiqueTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    return timeSinceLastCritique >= cooldownMs;
  }
  
  /**
   * Updates critique history for rate limiting
   */
  private updateCritiqueHistory() {
    const now = Date.now();
    this.critiqueHistory.lastCritiqueTime = now;
    this.critiqueHistory.critiqueCount++;
    this.critiqueHistory.hourlyCritiqueCount++;
  }

  /**
   * Estimates token usage for critique operation
   */
  private estimateCritiqueTokens(fileCount: number): number {
    // Base estimation: 800 tokens per file critique (prompt + response)
    // Additional overhead for analysis and recommendations
    const baseTokensPerFile = 800;
    const analysisOverhead = 500;
    
    return (fileCount * baseTokensPerFile) + analysisOverhead;
  }
  
  /**
   * Gets current engine status
   */
  getStatus(): {
    config: SelfCritiqueConfig;
    history: CritiqueHistory;
    canCritique: boolean;
    nextAllowedTime: number;
  } {
    const canCritique = this.config.enabled && this.checkRateLimits();
    const nextAllowedTime = this.critiqueHistory.lastCritiqueTime + 
      (this.config.cooldownMinutes * 60 * 1000);
    
    return {
      config: this.config,
      history: this.critiqueHistory,
      canCritique,
      nextAllowedTime
    };
  }
  
  /**
   * Generates summary for planning integration
   */
  generateCritiqueSummary(recentCritiques: CritiqueEntry[]): string {
    if (recentCritiques.length === 0) {
      return 'No recent self-critiques available.';
    }
    
    const avgQuality = recentCritiques.reduce((sum, c) => sum + c.quality, 0) / recentCritiques.length;
    const lowQualityFiles = recentCritiques.filter(c => c.quality < 6);
    
    const commonIssues = this.analyzeOverallPatterns(recentCritiques).commonIssues;
    
    return `
🔍 Self-Critique Summary (${recentCritiques.length} recent reviews):
- Average quality: ${avgQuality.toFixed(1)}/10
- Files needing attention: ${lowQualityFiles.length}
- Common issues: ${commonIssues.slice(0, 3).join(', ') || 'None identified'}
- Focus areas for improvement: ${lowQualityFiles.length > 0 ? 'Code quality, maintainability' : 'Continue current practices'}
    `.trim();
  }
}

// Global critique engine instance
export const claudeCritiqueEngine = new ClaudeCritiqueEngine();

/**
 * Hook for components to use the critique engine
 */
export function useCritiqueEngine() {
  return {
    engine: claudeCritiqueEngine,
    analyzeAndCritique: (targetFiles?: string[]) => claudeCritiqueEngine.analyzeAndCritique(targetFiles),
    updateConfig: (config: Partial<SelfCritiqueConfig>) => claudeCritiqueEngine.updateConfig(config),
    getStatus: () => claudeCritiqueEngine.getStatus(),
    generateSummary: (critiques: CritiqueEntry[]) => claudeCritiqueEngine.generateCritiqueSummary(critiques)
  };
}