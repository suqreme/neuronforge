import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentFeedback, FeedbackSummary } from '../types';

interface AgentFeedbackState {
  feedbacks: AgentFeedback[];
  
  // Core operations
  addFeedback: (feedback: Omit<AgentFeedback, 'id' | 'timestamp'>) => void;
  updateFeedback: (id: string, updates: Partial<AgentFeedback>) => void;
  deleteFeedback: (id: string) => void;
  markFeedbackResolved: (id: string) => void;
  
  // Query operations
  getFeedbacksForAgent: (agentId: string) => AgentFeedback[];
  getFeedbacksForFile: (filePath: string) => AgentFeedback[];
  getRecentFeedbacks: (limit?: number) => AgentFeedback[];
  getFeedbacksByCategory: (category: string) => AgentFeedback[];
  getUnresolvedFeedbacks: () => AgentFeedback[];
  
  // Analytics
  getFeedbackSummary: (agentId: string) => FeedbackSummary;
  getQualityTrend: (agentId: string, days?: number) => number[];
  getTopIssues: (limit?: number) => Array<{ category: string; count: number }>;
  
  // Maintenance
  cleanupOldFeedbacks: (olderThanDays: number) => void;
  clearAllFeedbacks: () => void;
  
  // Settings
  maxFeedbacks: number;
  setMaxFeedbacks: (max: number) => void;
}

export const useAgentFeedbackStore = create<AgentFeedbackState>()(
  persist(
    (set, get) => ({
      feedbacks: [],
      maxFeedbacks: 1000, // Limit to prevent memory bloat and token burns
      
      addFeedback: (feedbackData) => {
        const feedback: AgentFeedback = {
          ...feedbackData,
          id: crypto.randomUUID(),
          timestamp: Date.now()
        };
        
        set((state) => {
          let newFeedbacks = [...state.feedbacks, feedback];
          
          // Trim feedbacks if we exceed the limit (IMPORTANT: Prevents token burning)
          if (newFeedbacks.length > state.maxFeedbacks) {
            newFeedbacks = newFeedbacks
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, state.maxFeedbacks);
          }
          
          return { feedbacks: newFeedbacks };
        });
      },
      
      updateFeedback: (id, updates) => {
        set((state) => ({
          feedbacks: state.feedbacks.map(feedback =>
            feedback.id === id ? { ...feedback, ...updates } : feedback
          )
        }));
      },
      
      deleteFeedback: (id) => {
        set((state) => ({
          feedbacks: state.feedbacks.filter(feedback => feedback.id !== id)
        }));
      },
      
      markFeedbackResolved: (id) => {
        get().updateFeedback(id, { isResolved: true });
      },
      
      getFeedbacksForAgent: (agentId) => {
        return get().feedbacks.filter(feedback => feedback.agent === agentId);
      },
      
      getFeedbacksForFile: (filePath) => {
        return get().feedbacks.filter(feedback => feedback.targetFile === filePath);
      },
      
      getRecentFeedbacks: (limit = 20) => {
        return get().feedbacks
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },
      
      getFeedbacksByCategory: (category) => {
        return get().feedbacks.filter(feedback => feedback.category === category);
      },
      
      getUnresolvedFeedbacks: () => {
        return get().feedbacks.filter(feedback => !feedback.isResolved);
      },
      
      getFeedbackSummary: (agentId) => {
        const agentFeedbacks = get().getFeedbacksForAgent(agentId);
        
        if (agentFeedbacks.length === 0) {
          return {
            agent: agentId,
            totalFeedbacks: 0,
            averageQualityScore: 0,
            categoryBreakdown: {},
            recentTrends: { improving: false, scoreChange: 0 },
            topIssues: []
          };
        }
        
        // Calculate averages and trends
        const totalScore = agentFeedbacks.reduce((sum, f) => sum + f.qualityScore, 0);
        const averageQualityScore = totalScore / agentFeedbacks.length;
        
        // Category breakdown
        const categoryBreakdown: Record<string, number> = {};
        agentFeedbacks.forEach(feedback => {
          categoryBreakdown[feedback.category] = (categoryBreakdown[feedback.category] || 0) + 1;
        });
        
        // Recent trends (last 10 vs previous 10)
        const sortedFeedbacks = agentFeedbacks.sort((a, b) => b.timestamp - a.timestamp);
        const recent10 = sortedFeedbacks.slice(0, 10);
        const previous10 = sortedFeedbacks.slice(10, 20);
        
        const recentAvg = recent10.length > 0 
          ? recent10.reduce((sum, f) => sum + f.qualityScore, 0) / recent10.length 
          : averageQualityScore;
        const previousAvg = previous10.length > 0 
          ? previous10.reduce((sum, f) => sum + f.qualityScore, 0) / previous10.length 
          : averageQualityScore;
        
        const scoreChange = recentAvg - previousAvg;
        
        // Top issues
        const topIssues = Object.entries(categoryBreakdown)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([category]) => category);
        
        return {
          agent: agentId,
          totalFeedbacks: agentFeedbacks.length,
          averageQualityScore,
          categoryBreakdown,
          recentTrends: {
            improving: scoreChange > 0,
            scoreChange
          },
          topIssues
        };
      },
      
      getQualityTrend: (agentId, days = 7) => {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const agentFeedbacks = get().getFeedbacksForAgent(agentId)
          .filter(feedback => feedback.timestamp > cutoffTime)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Group by day and calculate daily averages
        const dailyScores: number[] = [];
        const msPerDay = 24 * 60 * 60 * 1000;
        
        for (let i = 0; i < days; i++) {
          const dayStart = cutoffTime + (i * msPerDay);
          const dayEnd = dayStart + msPerDay;
          
          const dayFeedbacks = agentFeedbacks.filter(f => 
            f.timestamp >= dayStart && f.timestamp < dayEnd
          );
          
          if (dayFeedbacks.length > 0) {
            const dayAverage = dayFeedbacks.reduce((sum, f) => sum + f.qualityScore, 0) / dayFeedbacks.length;
            dailyScores.push(dayAverage);
          } else {
            dailyScores.push(0);
          }
        }
        
        return dailyScores;
      },
      
      getTopIssues: (limit = 5) => {
        const categoryCount: Record<string, number> = {};
        
        get().feedbacks.forEach(feedback => {
          categoryCount[feedback.category] = (categoryCount[feedback.category] || 0) + 1;
        });
        
        return Object.entries(categoryCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, limit)
          .map(([category, count]) => ({ category, count }));
      },
      
      cleanupOldFeedbacks: (olderThanDays) => {
        const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        
        set((state) => ({
          feedbacks: state.feedbacks.filter(feedback => feedback.timestamp > cutoffTime)
        }));
      },
      
      clearAllFeedbacks: () => {
        set({ feedbacks: [] });
      },
      
      setMaxFeedbacks: (max) => {
        set((state) => {
          let newFeedbacks = state.feedbacks;
          
          // If reducing the limit, trim existing feedbacks
          if (max < state.feedbacks.length) {
            newFeedbacks = state.feedbacks
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, max);
          }
          
          return { 
            maxFeedbacks: max,
            feedbacks: newFeedbacks
          };
        });
      }
    }),
    {
      name: 'agent-feedback-storage',
      version: 1,
      // Reduce storage by only persisting essential data
      partialize: (state) => ({
        feedbacks: state.feedbacks.slice(-500), // Only persist last 500 feedbacks
        maxFeedbacks: state.maxFeedbacks
      })
    }
  )
);

// Utility functions for feedback management
export const FeedbackUtils = {
  /**
   * Creates a standardized feedback entry
   */
  createFeedback: (
    agent: string,
    reviewer: string,
    targetFile: string,
    feedback: string,
    qualityScore: number,
    category: AgentFeedback['category'],
    severity: AgentFeedback['severity'] = 'medium',
    suggestions?: string[]
  ): Omit<AgentFeedback, 'id' | 'timestamp'> => ({
    agent,
    reviewer,
    targetFile,
    feedback,
    qualityScore: Math.max(0, Math.min(1, qualityScore)), // Clamp between 0-1
    category,
    severity,
    suggestions,
    isResolved: false
  }),
  
  /**
   * Generates a quick feedback summary for display
   */
  formatFeedbackSummary: (summary: FeedbackSummary): string => {
    const trend = summary.recentTrends.improving ? '📈' : '📉';
    const score = Math.round(summary.averageQualityScore * 100);
    
    return `${trend} ${score}% avg quality (${summary.totalFeedbacks} reviews)`;
  },
  
  /**
   * Gets the emoji for a feedback category
   */
  getCategoryEmoji: (category: AgentFeedback['category']): string => {
    const emojiMap = {
      code_quality: '🔧',
      performance: '⚡',
      style: '🎨',
      best_practice: '📚',
      security: '🔒',
      maintainability: '🛠️'
    };
    return emojiMap[category] || '📝';
  },
  
  /**
   * Gets color class for severity
   */
  getSeverityColor: (severity: AgentFeedback['severity']): string => {
    const colorMap = {
      low: 'text-green-400',
      medium: 'text-yellow-400',
      high: 'text-red-400'
    };
    return colorMap[severity] || 'text-gray-400';
  }
};