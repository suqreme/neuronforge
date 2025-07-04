import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CritiqueEntry, CritiqueAnalysis } from '../agents/ClaudeCritiqueEngine';

interface SelfCritiqueState {
  critiques: CritiqueEntry[];
  analyses: CritiqueAnalysis[];
  
  // Core operations
  addCritique: (critique: CritiqueEntry) => void;
  addAnalysis: (analysis: CritiqueAnalysis) => void;
  deleteCritique: (id: string) => void;
  updateCritique: (id: string, updates: Partial<CritiqueEntry>) => void;
  
  // Query operations
  getCritiquesForFile: (filePath: string) => CritiqueEntry[];
  getRecentCritiques: (limit?: number) => CritiqueEntry[];
  getCritiquesByQuality: (minQuality: number, maxQuality: number) => CritiqueEntry[];
  getCritiquesByFocusArea: (focusArea: string) => CritiqueEntry[];
  getLowQualityFiles: (threshold?: number) => CritiqueEntry[];
  
  // Analytics
  getCritiqueSummary: () => {
    totalCritiques: number;
    averageQuality: number;
    qualityDistribution: Record<string, number>;
    focusAreaBreakdown: Record<string, number>;
    improvementTrends: {
      improving: boolean;
      recentAverage: number;
      previousAverage: number;
    };
  };
  
  getCommonIssues: (limit?: number) => Array<{ issue: string; count: number; files: string[] }>;
  getTopSuggestions: (limit?: number) => Array<{ suggestion: string; count: number }>;
  getQualityTrend: (days?: number) => number[];
  
  // File-specific insights
  getFileInsights: (filePath: string) => {
    latestCritique: CritiqueEntry | null;
    qualityHistory: number[];
    improvementSuggestions: string[];
    riskScore: number;
  };
  
  // Planning integration
  getPlanningInsights: () => {
    critiqueSummary: string;
    avoidancePatterns: string[];
    improvementGoals: string[];
    qualityMetrics: {
      averageQuality: number;
      problemFiles: string[];
      successPatterns: string[];
    };
  };
  
  // Maintenance
  cleanupOldCritiques: (olderThanDays: number) => void;
  clearAllCritiques: () => void;
  
  // Settings
  maxCritiques: number;
  setMaxCritiques: (max: number) => void;
}

export const useSelfCritiqueStore = create<SelfCritiqueState>()( 
  persist(
    (set, get) => ({
      critiques: [],
      analyses: [],
      maxCritiques: 500, // Limit to prevent memory bloat
      
      addCritique: (critique) => {
        set((state) => {
          let newCritiques = [...state.critiques, critique];
          
          // Trim critiques if we exceed the limit
          if (newCritiques.length > state.maxCritiques) {
            newCritiques = newCritiques
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, state.maxCritiques);
          }
          
          return { critiques: newCritiques };
        });
      },
      
      addAnalysis: (analysis) => {
        set((state) => {
          let newAnalyses = [...state.analyses, analysis];
          
          // Keep only last 50 analyses
          if (newAnalyses.length > 50) {
            newAnalyses = newAnalyses
              .sort((a, b) => (b.critiques[0]?.timestamp || 0) - (a.critiques[0]?.timestamp || 0))
              .slice(0, 50);
          }
          
          return { analyses: newAnalyses };
        });
      },
      
      deleteCritique: (id) => {
        set((state) => ({
          critiques: state.critiques.filter(critique => critique.id !== id)
        }));
      },
      
      updateCritique: (id, updates) => {
        set((state) => ({
          critiques: state.critiques.map(critique =>
            critique.id === id ? { ...critique, ...updates } : critique
          )
        }));
      },
      
      getCritiquesForFile: (filePath) => {
        return get().critiques.filter(critique => critique.filePath === filePath)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
      
      getRecentCritiques: (limit = 20) => {
        return get().critiques
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },
      
      getCritiquesByQuality: (minQuality, maxQuality) => {
        return get().critiques.filter(critique => 
          critique.quality >= minQuality && critique.quality <= maxQuality
        );
      },
      
      getCritiquesByFocusArea: (focusArea) => {
        return get().critiques.filter(critique => critique.focusArea === focusArea);
      },
      
      getLowQualityFiles: (threshold = 6) => {
        return get().critiques
          .filter(critique => critique.quality < threshold)
          .sort((a, b) => a.quality - b.quality);
      },
      
      getCritiqueSummary: () => {
        const critiques = get().critiques;
        
        if (critiques.length === 0) {
          return {
            totalCritiques: 0,
            averageQuality: 0,
            qualityDistribution: {},
            focusAreaBreakdown: {},
            improvementTrends: {
              improving: false,
              recentAverage: 0,
              previousAverage: 0
            }
          };
        }
        
        const totalQuality = critiques.reduce((sum, c) => sum + c.quality, 0);
        const averageQuality = totalQuality / critiques.length;
        
        // Quality distribution
        const qualityDistribution: Record<string, number> = {};
        critiques.forEach(critique => {
          const range = getQualityRange(critique.quality);
          qualityDistribution[range] = (qualityDistribution[range] || 0) + 1;
        });
        
        // Focus area breakdown
        const focusAreaBreakdown: Record<string, number> = {};
        critiques.forEach(critique => {
          focusAreaBreakdown[critique.focusArea] = (focusAreaBreakdown[critique.focusArea] || 0) + 1;
        });
        
        // Improvement trends
        const sortedCritiques = critiques.sort((a, b) => a.timestamp - b.timestamp);
        const halfPoint = Math.floor(sortedCritiques.length / 2);
        const recentCritiques = sortedCritiques.slice(halfPoint);
        const previousCritiques = sortedCritiques.slice(0, halfPoint);
        
        const recentAverage = recentCritiques.length > 0 
          ? recentCritiques.reduce((sum, c) => sum + c.quality, 0) / recentCritiques.length
          : averageQuality;
        const previousAverage = previousCritiques.length > 0
          ? previousCritiques.reduce((sum, c) => sum + c.quality, 0) / previousCritiques.length
          : averageQuality;
        
        return {
          totalCritiques: critiques.length,
          averageQuality,
          qualityDistribution,
          focusAreaBreakdown,
          improvementTrends: {
            improving: recentAverage > previousAverage,
            recentAverage,
            previousAverage
          }
        };
      },
      
      getCommonIssues: (limit = 10) => {
        const critiques = get().critiques;
        const issueMap = new Map<string, { count: number; files: Set<string> }>();
        
        critiques.forEach(critique => {
          critique.reasons.forEach(reason => {
            const normalizedReason = reason.toLowerCase().trim();
            if (!issueMap.has(normalizedReason)) {
              issueMap.set(normalizedReason, { count: 0, files: new Set() });
            }
            const entry = issueMap.get(normalizedReason)!;
            entry.count++;
            entry.files.add(critique.filePath);
          });
        });
        
        return Array.from(issueMap.entries())
          .map(([issue, data]) => ({
            issue,
            count: data.count,
            files: Array.from(data.files)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      },
      
      getTopSuggestions: (limit = 10) => {
        const critiques = get().critiques;
        const suggestionMap = new Map<string, number>();
        
        critiques.forEach(critique => {
          critique.suggestions.forEach(suggestion => {
            const normalizedSuggestion = suggestion.toLowerCase().trim();
            suggestionMap.set(normalizedSuggestion, (suggestionMap.get(normalizedSuggestion) || 0) + 1);
          });
        });
        
        return Array.from(suggestionMap.entries())
          .map(([suggestion, count]) => ({ suggestion, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      },
      
      getQualityTrend: (days = 7) => {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const critiques = get().critiques
          .filter(critique => critique.timestamp > cutoffTime)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Group by day and calculate daily averages
        const dailyScores: number[] = [];
        const msPerDay = 24 * 60 * 60 * 1000;
        
        for (let i = 0; i < days; i++) {
          const dayStart = cutoffTime + (i * msPerDay);
          const dayEnd = dayStart + msPerDay;
          
          const dayCritiques = critiques.filter(c => 
            c.timestamp >= dayStart && c.timestamp < dayEnd
          );
          
          if (dayCritiques.length > 0) {
            const dayAverage = dayCritiques.reduce((sum, c) => sum + c.quality, 0) / dayCritiques.length;
            dailyScores.push(dayAverage);
          } else {
            dailyScores.push(0);
          }
        }
        
        return dailyScores;
      },
      
      getFileInsights: (filePath) => {
        const fileCritiques = get().getCritiquesForFile(filePath);
        
        if (fileCritiques.length === 0) {
          return {
            latestCritique: null,
            qualityHistory: [],
            improvementSuggestions: [],
            riskScore: 0
          };
        }
        
        const latestCritique = fileCritiques[0];
        const qualityHistory = fileCritiques.map(c => c.quality).reverse();
        
        // Get unique suggestions across all critiques for this file
        const allSuggestions = fileCritiques.flatMap(c => c.suggestions);
        const uniqueSuggestions = Array.from(new Set(allSuggestions));
        
        // Calculate risk score based on quality trend and issues
        const avgQuality = qualityHistory.reduce((sum, q) => sum + q, 0) / qualityHistory.length;
        const hasDecreasingTrend = qualityHistory.length >= 2 && 
          qualityHistory[qualityHistory.length - 1] < qualityHistory[0];
        const riskScore = (10 - avgQuality) / 10 + (hasDecreasingTrend ? 0.2 : 0);
        
        return {
          latestCritique,
          qualityHistory,
          improvementSuggestions: uniqueSuggestions.slice(0, 5),
          riskScore: Math.min(1, Math.max(0, riskScore))
        };
      },
      
      getPlanningInsights: () => {
        const summary = get().getCritiqueSummary();
        const commonIssues = get().getCommonIssues(5);
        const topSuggestions = get().getTopSuggestions(5);
        const lowQualityFiles = get().getLowQualityFiles(6);
        
        // Generate critique summary for planning
        const critiqueSummary = `
Self-Critique Summary (${summary.totalCritiques} reviews):
- Average quality: ${summary.averageQuality.toFixed(1)}/10
- Trend: ${summary.improvementTrends.improving ? 'Improving' : 'Declining'} 
- Low quality files: ${lowQualityFiles.length}
        `.trim();
        
        // Extract avoidance patterns from common issues
        const avoidancePatterns = commonIssues
          .slice(0, 3)
          .map(issue => `Avoid: ${issue.issue} (seen in ${issue.count} files)`);
        
        // Generate improvement goals from suggestions
        const improvementGoals = topSuggestions
          .slice(0, 3)
          .map(suggestion => suggestion.suggestion);
        
        // Quality metrics for planning
        const qualityMetrics = {
          averageQuality: summary.averageQuality,
          problemFiles: lowQualityFiles.slice(0, 5).map(c => c.filePath),
          successPatterns: get().critiques
            .filter(c => c.quality >= 8)
            .flatMap(c => c.reasons)
            .slice(0, 3)
        };
        
        return {
          critiqueSummary,
          avoidancePatterns,
          improvementGoals,
          qualityMetrics
        };
      },
      
      cleanupOldCritiques: (olderThanDays) => {
        const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        
        set((state) => ({
          critiques: state.critiques.filter(critique => critique.timestamp > cutoffTime),
          analyses: state.analyses.filter(analysis => 
            (analysis.critiques[0]?.timestamp || 0) > cutoffTime
          )
        }));
      },
      
      clearAllCritiques: () => {
        set({ critiques: [], analyses: [] });
      },
      
      setMaxCritiques: (max) => {
        set((state) => {
          let newCritiques = state.critiques;
          
          // If reducing the limit, trim existing critiques
          if (max < state.critiques.length) {
            newCritiques = state.critiques
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, max);
          }
          
          return { 
            maxCritiques: max,
            critiques: newCritiques
          };
        });
      }
    }),
    {
      name: 'self-critique-storage',
      version: 1,
      // Reduce storage by only persisting essential data
      partialize: (state) => ({
        critiques: state.critiques.slice(-200), // Only persist last 200 critiques
        analyses: state.analyses.slice(-20), // Only persist last 20 analyses
        maxCritiques: state.maxCritiques
      })
    }
  )
);

/**
 * Helper function to categorize quality scores
 */
function getQualityRange(quality: number): string {
  if (quality >= 9) return 'Excellent (9-10)';
  if (quality >= 7) return 'Good (7-8)';
  if (quality >= 5) return 'Average (5-6)';
  if (quality >= 3) return 'Poor (3-4)';
  return 'Critical (1-2)';
}

/**
 * Utility functions for critique management
 */
export const CritiqueUtils = {
  /**
   * Formats a critique for display
   */
  formatCritique: (critique: CritiqueEntry): string => {
    const qualityEmoji = critique.quality >= 8 ? '✅' : critique.quality >= 6 ? '⚠️' : '❌';
    return `${qualityEmoji} ${critique.filePath} (${critique.quality}/10) - ${critique.focusArea}`;
  },
  
  /**
   * Gets color class for quality score
   */
  getQualityColor: (quality: number): string => {
    if (quality >= 8) return 'text-green-400';
    if (quality >= 6) return 'text-yellow-400';
    if (quality >= 4) return 'text-orange-400';
    return 'text-red-400';
  },
  
  /**
   * Gets emoji for focus area
   */
  getFocusAreaEmoji: (focusArea: string): string => {
    const emojiMap = {
      code_quality: '🔧',
      maintainability: '🛠️',
      performance: '⚡',
      security: '🔒',
      best_practices: '📚',
      style: '🎨'
    };
    return emojiMap[focusArea as keyof typeof emojiMap] || '📝';
  },
  
  /**
   * Calculates confidence level description
   */
  getConfidenceLevel: (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    if (confidence >= 0.4) return 'Low';
    return 'Very Low';
  }
};