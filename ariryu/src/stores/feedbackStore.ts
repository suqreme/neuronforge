import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeedbackEntry {
  id: string;
  type: 'file' | 'plan' | 'log' | 'memory';
  target: string; // file path, log ID, memory ID, etc.
  feedback: string;
  rating: number; // 1-5 scale
  category: 'quality' | 'usability' | 'accuracy' | 'style' | 'performance';
  source: 'user';
  timestamp: number;
  context?: string; // Additional context about the target
  metadata?: {
    targetDisplay?: string; // Human-readable target name
    userAgent?: string;
    sessionId?: string;
    tags?: string[];
  };
}

export interface FeedbackSummary {
  totalFeedbacks: number;
  averageRating: number;
  ratingDistribution: Record<number, number>; // rating -> count
  categoryBreakdown: Record<string, number>; // category -> count
  targetCount: number; // unique targets with feedback
  lowRatingCount: number; // feedbacks with rating <= 2
  highRatingCount: number; // feedbacks with rating >= 4
  recentTargets: string[]; // most recently reviewed targets
  improvementTrends: {
    improving: boolean;
    recentAverage: number;
    previousAverage: number;
  };
}

interface FeedbackState {
  feedbacks: FeedbackEntry[];
  
  // Core operations
  addFeedback: (feedback: FeedbackEntry) => void;
  deleteFeedback: (id: string) => void;
  updateFeedback: (id: string, updates: Partial<FeedbackEntry>) => void;
  
  // Query operations
  getFeedbacksForTarget: (target: string) => FeedbackEntry[];
  getFeedbacksByCategory: (category: string) => FeedbackEntry[];
  getFeedbacksByRating: (minRating: number, maxRating: number) => FeedbackEntry[];
  getRecentFeedbacks: (limit?: number) => FeedbackEntry[];
  getLowRatingFeedbacks: (threshold?: number) => FeedbackEntry[];
  getHighRatingFeedbacks: (threshold?: number) => FeedbackEntry[];
  
  // Analytics
  getFeedbackSummary: () => FeedbackSummary;
  getTargetRating: (target: string) => { average: number; count: number };
  getCategoryInsights: (category: string) => {
    averageRating: number;
    commonWords: string[];
    improvementSuggestions: string[];
  };
  
  // Claude integration helpers
  getFeedbackContextForTarget: (target: string) => string;
  getFeedbackContextForPlanning: () => string;
  getRecentNegativeFeedback: (limit?: number) => FeedbackEntry[];
  getRecentPositiveFeedback: (limit?: number) => FeedbackEntry[];
  
  // Maintenance
  cleanupOldFeedbacks: (olderThanDays: number) => void;
  clearAllFeedbacks: () => void;
  
  // Settings
  maxFeedbacks: number;
  setMaxFeedbacks: (max: number) => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      feedbacks: [],
      maxFeedbacks: 1000, // Limit to prevent memory bloat
      
      addFeedback: (feedback) => {
        set((state) => {
          let newFeedbacks = [...state.feedbacks, feedback];
          
          // Trim feedbacks if we exceed the limit
          if (newFeedbacks.length > state.maxFeedbacks) {
            newFeedbacks = newFeedbacks
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, state.maxFeedbacks);
          }
          
          return { feedbacks: newFeedbacks };
        });
      },
      
      deleteFeedback: (id) => {
        set((state) => ({
          feedbacks: state.feedbacks.filter(feedback => feedback.id !== id)
        }));
      },
      
      updateFeedback: (id, updates) => {
        set((state) => ({
          feedbacks: state.feedbacks.map(feedback =>
            feedback.id === id ? { ...feedback, ...updates } : feedback
          )
        }));
      },
      
      getFeedbacksForTarget: (target) => {
        return get().feedbacks
          .filter(feedback => feedback.target === target)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
      
      getFeedbacksByCategory: (category) => {
        return get().feedbacks
          .filter(feedback => feedback.category === category)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
      
      getFeedbacksByRating: (minRating, maxRating) => {
        return get().feedbacks.filter(feedback => 
          feedback.rating >= minRating && feedback.rating <= maxRating
        );
      },
      
      getRecentFeedbacks: (limit = 20) => {
        return get().feedbacks
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },
      
      getLowRatingFeedbacks: (threshold = 2) => {
        return get().feedbacks
          .filter(feedback => feedback.rating <= threshold)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
      
      getHighRatingFeedbacks: (threshold = 4) => {
        return get().feedbacks
          .filter(feedback => feedback.rating >= threshold)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
      
      getFeedbackSummary: (): FeedbackSummary => {
        const feedbacks = get().feedbacks;
        
        if (feedbacks.length === 0) {
          return {
            totalFeedbacks: 0,
            averageRating: 0,
            ratingDistribution: {},
            categoryBreakdown: {},
            targetCount: 0,
            lowRatingCount: 0,
            highRatingCount: 0,
            recentTargets: [],
            improvementTrends: {
              improving: false,
              recentAverage: 0,
              previousAverage: 0
            }
          };
        }
        
        const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
        const averageRating = totalRating / feedbacks.length;
        
        // Rating distribution
        const ratingDistribution: Record<number, number> = {};
        feedbacks.forEach(feedback => {
          ratingDistribution[feedback.rating] = (ratingDistribution[feedback.rating] || 0) + 1;
        });
        
        // Category breakdown
        const categoryBreakdown: Record<string, number> = {};
        feedbacks.forEach(feedback => {
          categoryBreakdown[feedback.category] = (categoryBreakdown[feedback.category] || 0) + 1;
        });
        
        // Unique targets
        const uniqueTargets = new Set(feedbacks.map(f => f.target));
        const targetCount = uniqueTargets.size;
        
        // Rating counts
        const lowRatingCount = feedbacks.filter(f => f.rating <= 2).length;
        const highRatingCount = feedbacks.filter(f => f.rating >= 4).length;
        
        // Recent targets
        const recentTargets = feedbacks
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10)
          .map(f => f.metadata?.targetDisplay || f.target);
        
        // Improvement trends
        const sortedFeedbacks = feedbacks.sort((a, b) => a.timestamp - b.timestamp);
        const halfPoint = Math.floor(sortedFeedbacks.length / 2);
        const recentFeedbacks = sortedFeedbacks.slice(halfPoint);
        const previousFeedbacks = sortedFeedbacks.slice(0, halfPoint);
        
        const recentAverage = recentFeedbacks.length > 0 
          ? recentFeedbacks.reduce((sum, f) => sum + f.rating, 0) / recentFeedbacks.length
          : averageRating;
        const previousAverage = previousFeedbacks.length > 0
          ? previousFeedbacks.reduce((sum, f) => sum + f.rating, 0) / previousFeedbacks.length
          : averageRating;
        
        return {
          totalFeedbacks: feedbacks.length,
          averageRating,
          ratingDistribution,
          categoryBreakdown,
          targetCount,
          lowRatingCount,
          highRatingCount,
          recentTargets: Array.from(new Set(recentTargets)),
          improvementTrends: {
            improving: recentAverage > previousAverage,
            recentAverage,
            previousAverage
          }
        };
      },
      
      getTargetRating: (target) => {
        const targetFeedbacks = get().getFeedbacksForTarget(target);
        if (targetFeedbacks.length === 0) {
          return { average: 0, count: 0 };
        }
        
        const totalRating = targetFeedbacks.reduce((sum, f) => sum + f.rating, 0);
        return {
          average: totalRating / targetFeedbacks.length,
          count: targetFeedbacks.length
        };
      },
      
      getCategoryInsights: (category) => {
        const categoryFeedbacks = get().getFeedbacksByCategory(category);
        
        if (categoryFeedbacks.length === 0) {
          return {
            averageRating: 0,
            commonWords: [],
            improvementSuggestions: []
          };
        }
        
        const totalRating = categoryFeedbacks.reduce((sum, f) => sum + f.rating, 0);
        const averageRating = totalRating / categoryFeedbacks.length;
        
        // Extract common words from feedback text
        const allWords = categoryFeedbacks
          .flatMap(f => f.feedback.toLowerCase().split(/\s+/))
          .filter(word => word.length > 3); // Filter short words
        
        const wordCounts = allWords.reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const commonWords = Object.entries(wordCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([word]) => word);
        
        // Extract improvement suggestions from low-rated feedback
        const improvementSuggestions = categoryFeedbacks
          .filter(f => f.rating <= 3)
          .map(f => f.feedback)
          .slice(0, 3);
        
        return {
          averageRating,
          commonWords,
          improvementSuggestions
        };
      },
      
      getFeedbackContextForTarget: (target) => {
        const targetFeedbacks = get().getFeedbacksForTarget(target);
        
        if (targetFeedbacks.length === 0) {
          return `No user feedback available for ${target}.`;
        }
        
        const targetRating = get().getTargetRating(target);
        const recentFeedback = targetFeedbacks.slice(0, 3);
        
        return `
User Feedback for ${target}:
- Average rating: ${targetRating.average.toFixed(1)}/5 (${targetRating.count} reviews)
- Recent feedback:
${recentFeedback.map(f => 
  `  • ${f.rating}/5 (${f.category}): "${f.feedback}"`
).join('\n')}
        `.trim();
      },
      
      getFeedbackContextForPlanning: () => {
        const summary = get().getFeedbackSummary();
        const recentNegative = get().getRecentNegativeFeedback(5);
        const recentPositive = get().getRecentPositiveFeedback(3);
        
        if (summary.totalFeedbacks === 0) {
          return `No user feedback available yet. Focus on creating high-quality, user-friendly outputs.`;
        }
        
        return `
📋 User Feedback Summary (${summary.totalFeedbacks} total):
- Overall satisfaction: ${summary.averageRating.toFixed(1)}/5
- Trend: ${summary.improvementTrends.improving ? 'Improving' : 'Declining'} 
- Problem areas: ${summary.lowRatingCount} low ratings
- Success areas: ${summary.highRatingCount} high ratings

🚨 Recent Issues to Address:
${recentNegative.length > 0 ? recentNegative.map(f => 
  `• ${f.metadata?.targetDisplay || f.target}: "${f.feedback}" (${f.rating}/5)`
).join('\n') : '• No major issues reported'}

✅ Recent Successes to Continue:
${recentPositive.length > 0 ? recentPositive.map(f => 
  `• ${f.metadata?.targetDisplay || f.target}: "${f.feedback}" (${f.rating}/5)`
).join('\n') : '• No specific successes highlighted'}

💡 Focus Areas: ${Object.entries(summary.categoryBreakdown)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(([category, count]) => `${category} (${count})`)
  .join(', ')}
        `.trim();
      },
      
      getRecentNegativeFeedback: (limit = 10) => {
        return get().feedbacks
          .filter(feedback => feedback.rating <= 2)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },
      
      getRecentPositiveFeedback: (limit = 10) => {
        return get().feedbacks
          .filter(feedback => feedback.rating >= 4)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
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
      name: 'feedback-storage',
      version: 1,
      // Reduce storage by only persisting recent feedbacks
      partialize: (state) => ({
        feedbacks: state.feedbacks.slice(-500), // Only persist last 500 feedbacks
        maxFeedbacks: state.maxFeedbacks
      })
    }
  )
);

/**
 * Utility functions for feedback management
 */
export const FeedbackUtils = {
  /**
   * Formats feedback for display
   */
  formatFeedback: (feedback: FeedbackEntry): string => {
    const ratingEmoji = feedback.rating >= 4 ? '😊' : feedback.rating >= 3 ? '😐' : '😞';
    return `${ratingEmoji} ${feedback.metadata?.targetDisplay || feedback.target} (${feedback.rating}/5) - ${feedback.category}`;
  },
  
  /**
   * Gets color class for rating
   */
  getRatingColor: (rating: number): string => {
    if (rating >= 4) return 'text-green-400';
    if (rating >= 3) return 'text-yellow-400';
    if (rating >= 2) return 'text-orange-400';
    return 'text-red-400';
  },
  
  /**
   * Gets emoji for category
   */
  getCategoryEmoji: (category: string): string => {
    const emojiMap = {
      quality: '🔧',
      usability: '👤',
      accuracy: '🎯',
      style: '🎨',
      performance: '⚡'
    };
    return emojiMap[category as keyof typeof emojiMap] || '📝';
  },
  
  /**
   * Gets sentiment from rating
   */
  getSentiment: (rating: number): 'positive' | 'neutral' | 'negative' => {
    if (rating >= 4) return 'positive';
    if (rating >= 3) return 'neutral';
    return 'negative';
  },
  
  /**
   * Extracts actionable insights from feedback
   */
  extractActionableInsights: (feedbacks: FeedbackEntry[]): string[] => {
    const lowRatedFeedbacks = feedbacks.filter(f => f.rating <= 2);
    
    // Extract common themes from negative feedback
    const insights: string[] = [];
    
    const allFeedbackText = lowRatedFeedbacks.map(f => f.feedback.toLowerCase()).join(' ');
    
    // Common improvement keywords
    const improvementKeywords = [
      'simplify', 'improve', 'fix', 'better', 'cleaner', 'faster', 
      'easier', 'clearer', 'more', 'less', 'remove', 'add'
    ];
    
    improvementKeywords.forEach(keyword => {
      if (allFeedbackText.includes(keyword)) {
        insights.push(`Consider ${keyword} based on user feedback`);
      }
    });
    
    return insights.slice(0, 5); // Limit to top 5 insights
  },
  
  /**
   * Generates feedback prompt for Claude
   */
  generateFeedbackPrompt: (targetType: string, targetId: string, feedbacks: FeedbackEntry[]): string => {
    if (feedbacks.length === 0) {
      return `No user feedback available for this ${targetType}. Focus on best practices.`;
    }
    
    const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
    const concerns = feedbacks.filter(f => f.rating <= 2).map(f => f.feedback);
    const praise = feedbacks.filter(f => f.rating >= 4).map(f => f.feedback);
    
    return `
User feedback for ${targetType} "${targetId}":
- Average rating: ${avgRating.toFixed(1)}/5
- User concerns: ${concerns.length > 0 ? concerns.join(', ') : 'None reported'}
- User praise: ${praise.length > 0 ? praise.join(', ') : 'None yet'}

Please address concerns while maintaining praised aspects.
    `.trim();
  }
};