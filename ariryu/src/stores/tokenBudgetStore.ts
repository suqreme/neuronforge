import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Token budget configuration and thresholds
 */
export interface TokenBudgetConfig {
  dailyLimit: number;
  warningThreshold: number; // Percentage (0-1)
  criticalThreshold: number; // Percentage (0-1)
  resetIntervalHours: number;
  emergencyShutdownEnabled: boolean;
  degradationEnabled: boolean;
}

/**
 * Current token usage state
 */
export interface TokenUsageState {
  currentUsage: number;
  outputTokens: number;
  requestCount: number;
  lastReset: number;
  resetTime: number; // Next reset timestamp
  isEmergencyShutdown: boolean;
  degradationLevel: 'none' | 'light' | 'moderate' | 'severe';
  lastRequestTime: number;
}

/**
 * Token operation result
 */
export interface TokenOperationResult {
  allowed: boolean;
  reason?: string;
  degradationLevel: 'none' | 'light' | 'moderate' | 'severe';
  remainingTokens: number;
  usagePercentage: number;
}

/**
 * Token budget analytics
 */
export interface TokenAnalytics {
  usageToday: number;
  usagePercentage: number;
  projectedDailyUsage: number;
  averageRequestSize: number;
  peakUsageHour: number;
  requestsThisHour: number;
  timeUntilReset: number;
  status: 'normal' | 'warning' | 'critical' | 'emergency';
}

export const defaultTokenBudgetConfig: TokenBudgetConfig = {
  dailyLimit: 100000, // 100k tokens per day (SaaS ready)
  warningThreshold: 0.80, // 80%
  criticalThreshold: 0.95, // 95%
  resetIntervalHours: 24,
  emergencyShutdownEnabled: true,
  degradationEnabled: true
};

interface TokenBudgetState {
  config: TokenBudgetConfig;
  usage: TokenUsageState;
  
  // Core operations
  trackUsage: (inputTokens: number, outputTokens: number) => void;
  checkOperationAllowed: (estimatedTokens: number, operationType: string) => TokenOperationResult;
  
  // Emergency controls
  triggerEmergencyShutdown: () => void;
  clearEmergencyShutdown: () => void;
  
  // Configuration
  updateConfig: (newConfig: Partial<TokenBudgetConfig>) => void;
  
  // Analytics and status
  getAnalytics: () => TokenAnalytics;
  getStatus: () => 'normal' | 'warning' | 'critical' | 'emergency';
  getDegradationLevel: () => 'none' | 'light' | 'moderate' | 'severe';
  
  // Recovery and reset
  resetDailyUsage: () => void;
  autoRecovery: () => void;
  
  // Feature degradation checks
  isCriticAllowed: () => boolean;
  isPlanningAllowed: () => boolean;
  isMemorySummaryAllowed: () => boolean;
  isAutoExecutionAllowed: () => boolean;
  
  // Utilities
  getRemainingTokens: () => number;
  getTimeUntilReset: () => number;
  formatUsageDisplay: () => string;
}

export const useTokenBudgetStore = create<TokenBudgetState>()(
  persist(
    (set, get) => ({
      config: defaultTokenBudgetConfig,
      usage: {
        currentUsage: 0,
        outputTokens: 0,
        requestCount: 0,
        lastReset: Date.now(),
        resetTime: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
        isEmergencyShutdown: false,
        degradationLevel: 'none',
        lastRequestTime: 0
      },

      trackUsage: (inputTokens, outputTokens) => {
        set((state) => {
          const now = Date.now();
          const newUsage = state.usage.currentUsage + inputTokens + outputTokens;
          const newRequestCount = state.usage.requestCount + 1;
          
          // Check if we need to reset (24 hours passed)
          if (now >= state.usage.resetTime) {
            // Auto-reset daily usage
            const nextReset = now + (state.config.resetIntervalHours * 60 * 60 * 1000);
            return {
              usage: {
                ...state.usage,
                currentUsage: inputTokens + outputTokens,
                outputTokens: outputTokens,
                requestCount: 1,
                lastReset: now,
                resetTime: nextReset,
                lastRequestTime: now,
                isEmergencyShutdown: false, // Clear shutdown on reset
                degradationLevel: 'none'
              }
            };
          }

          // Calculate degradation level based on usage
          const usagePercentage = newUsage / state.config.dailyLimit;
          let degradationLevel: 'none' | 'light' | 'moderate' | 'severe' = 'none';
          
          if (usagePercentage >= state.config.criticalThreshold) {
            degradationLevel = 'severe';
          } else if (usagePercentage >= state.config.warningThreshold) {
            degradationLevel = 'moderate';
          } else if (usagePercentage >= 0.60) {
            degradationLevel = 'light';
          }

          // Emergency shutdown if critical threshold exceeded
          const shouldEmergencyShutdown = 
            state.config.emergencyShutdownEnabled && 
            usagePercentage >= state.config.criticalThreshold;

          return {
            usage: {
              ...state.usage,
              currentUsage: newUsage,
              outputTokens: state.usage.outputTokens + outputTokens,
              requestCount: newRequestCount,
              lastRequestTime: now,
              degradationLevel,
              isEmergencyShutdown: shouldEmergencyShutdown
            }
          };
        });
      },

      checkOperationAllowed: (estimatedTokens, operationType) => {
        const state = get();
        const { config, usage } = state;
        
        // Emergency shutdown check
        if (usage.isEmergencyShutdown) {
          return {
            allowed: false,
            reason: 'Emergency shutdown active - all AI operations disabled',
            degradationLevel: 'severe',
            remainingTokens: 0,
            usagePercentage: 1.0
          };
        }

        const projectedUsage = usage.currentUsage + estimatedTokens;
        const usagePercentage = projectedUsage / config.dailyLimit;
        const remainingTokens = Math.max(0, config.dailyLimit - usage.currentUsage);

        // Check if operation would exceed daily limit
        if (projectedUsage > config.dailyLimit) {
          return {
            allowed: false,
            reason: `Operation would exceed daily limit (${projectedUsage}/${config.dailyLimit} tokens)`,
            degradationLevel: usage.degradationLevel,
            remainingTokens,
            usagePercentage
          };
        }

        // Apply degradation rules based on operation type
        if (config.degradationEnabled) {
          const degradationLevel = usage.degradationLevel;
          
          // Severe degradation - only critical user operations
          if (degradationLevel === 'severe') {
            const allowedOperations = ['user_chat', 'user_prompt'];
            if (!allowedOperations.includes(operationType)) {
              return {
                allowed: false,
                reason: `Severe degradation: only user-initiated operations allowed`,
                degradationLevel,
                remainingTokens,
                usagePercentage
              };
            }
          }
          
          // Moderate degradation - no auto operations
          if (degradationLevel === 'moderate') {
            const blockedOperations = ['auto_critique', 'auto_summary', 'auto_planning'];
            if (blockedOperations.includes(operationType)) {
              return {
                allowed: false,
                reason: `Moderate degradation: ${operationType} temporarily disabled`,
                degradationLevel,
                remainingTokens,
                usagePercentage
              };
            }
          }
          
          // Light degradation - reduce context size
          if (degradationLevel === 'light') {
            const contextOperations = ['planning', 'critique', 'summary'];
            if (contextOperations.includes(operationType) && estimatedTokens > 5000) {
              return {
                allowed: false,
                reason: `Light degradation: reduce context size for ${operationType}`,
                degradationLevel,
                remainingTokens,
                usagePercentage
              };
            }
          }
        }

        return {
          allowed: true,
          degradationLevel: usage.degradationLevel,
          remainingTokens,
          usagePercentage
        };
      },

      triggerEmergencyShutdown: () => {
        set((state) => ({
          usage: {
            ...state.usage,
            isEmergencyShutdown: true,
            degradationLevel: 'severe'
          }
        }));
      },

      clearEmergencyShutdown: () => {
        set((state) => ({
          usage: {
            ...state.usage,
            isEmergencyShutdown: false
          }
        }));
      },

      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig }
        }));
      },

      getAnalytics: (): TokenAnalytics => {
        const state = get();
        const { config, usage } = state;
        const now = Date.now();
        
        const usagePercentage = usage.currentUsage / config.dailyLimit;
        const timeElapsed = now - usage.lastReset;
        const hoursElapsed = timeElapsed / (60 * 60 * 1000);
        const projectedDailyUsage = hoursElapsed > 0 ? (usage.currentUsage / hoursElapsed) * 24 : 0;
        const averageRequestSize = usage.requestCount > 0 ? usage.currentUsage / usage.requestCount : 0;
        const timeUntilReset = Math.max(0, usage.resetTime - now);

        let status: 'normal' | 'warning' | 'critical' | 'emergency' = 'normal';
        if (usage.isEmergencyShutdown) {
          status = 'emergency';
        } else if (usagePercentage >= config.criticalThreshold) {
          status = 'critical';
        } else if (usagePercentage >= config.warningThreshold) {
          status = 'warning';
        }

        return {
          usageToday: usage.currentUsage,
          usagePercentage,
          projectedDailyUsage,
          averageRequestSize,
          peakUsageHour: 0, // TODO: Track hourly usage
          requestsThisHour: usage.requestCount, // Simplified for now
          timeUntilReset,
          status
        };
      },

      getStatus: () => {
        return get().getAnalytics().status;
      },

      getDegradationLevel: () => {
        return get().usage.degradationLevel;
      },

      resetDailyUsage: () => {
        const now = Date.now();
        const nextReset = now + (get().config.resetIntervalHours * 60 * 60 * 1000);
        
        set((state) => ({
          usage: {
            ...state.usage,
            currentUsage: 0,
            outputTokens: 0,
            requestCount: 0,
            lastReset: now,
            resetTime: nextReset,
            isEmergencyShutdown: false,
            degradationLevel: 'none'
          }
        }));
      },

      autoRecovery: () => {
        const state = get();
        const now = Date.now();
        
        // Auto-recovery if usage has dropped below warning threshold
        const usagePercentage = state.usage.currentUsage / state.config.dailyLimit;
        
        if (state.usage.isEmergencyShutdown && usagePercentage < state.config.warningThreshold) {
          get().clearEmergencyShutdown();
        }
        
        // Auto-reset if reset time has passed
        if (now >= state.usage.resetTime) {
          get().resetDailyUsage();
        }
      },

      // Feature degradation checks
      isCriticAllowed: () => {
        const result = get().checkOperationAllowed(2000, 'auto_critique');
        return result.allowed;
      },

      isPlanningAllowed: () => {
        const result = get().checkOperationAllowed(3000, 'planning');
        return result.allowed;
      },

      isMemorySummaryAllowed: () => {
        const result = get().checkOperationAllowed(1500, 'auto_summary');
        return result.allowed;
      },

      isAutoExecutionAllowed: () => {
        const result = get().checkOperationAllowed(2500, 'auto_execution');
        return result.allowed;
      },

      getRemainingTokens: () => {
        const state = get();
        return Math.max(0, state.config.dailyLimit - state.usage.currentUsage);
      },

      getTimeUntilReset: () => {
        const state = get();
        return Math.max(0, state.usage.resetTime - Date.now());
      },

      formatUsageDisplay: () => {
        const state = get();
        const analytics = get().getAnalytics();
        const percentage = Math.round(analytics.usagePercentage * 100);
        const remaining = get().getRemainingTokens();
        
        return `${state.usage.currentUsage.toLocaleString()}/${state.config.dailyLimit.toLocaleString()} tokens (${percentage}%) - ${remaining.toLocaleString()} remaining`;
      }
    }),
    {
      name: 'token-budget-storage',
      version: 1,
      partialize: (state) => ({
        config: state.config,
        usage: state.usage
      })
    }
  )
);

/**
 * Utility functions for token budget management
 */
export const TokenBudgetUtils = {
  /**
   * Get status emoji for current usage level
   */
  getStatusEmoji: (status: 'normal' | 'warning' | 'critical' | 'emergency'): string => {
    const emojiMap = {
      normal: '🟢',
      warning: '🟡', 
      critical: '🔴',
      emergency: '🚨'
    };
    return emojiMap[status];
  },

  /**
   * Get status color for UI components
   */
  getStatusColor: (status: 'normal' | 'warning' | 'critical' | 'emergency'): string => {
    const colorMap = {
      normal: 'text-green-400',
      warning: 'text-yellow-400',
      critical: 'text-red-400', 
      emergency: 'text-red-600'
    };
    return colorMap[status];
  },

  /**
   * Get degradation level description
   */
  getDegradationDescription: (level: 'none' | 'light' | 'moderate' | 'severe'): string => {
    const descriptions = {
      none: 'All features enabled',
      light: 'Context size reduced for efficiency',
      moderate: 'Auto-operations disabled',
      severe: 'Only user-initiated operations allowed'
    };
    return descriptions[level];
  },

  /**
   * Format time remaining until reset
   */
  formatTimeUntilReset: (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },

  /**
   * Calculate optimal token allocation for operation
   */
  calculateOptimalAllocation: (
    operation: string, 
    availableTokens: number,
    degradationLevel: 'none' | 'light' | 'moderate' | 'severe'
  ): number => {
    const baseAllocations = {
      user_chat: 8000,
      planning: 5000,
      critique: 3000,
      summary: 2000,
      execution: 4000
    };

    const degradationFactors = {
      none: 1.0,
      light: 0.7,
      moderate: 0.5,
      severe: 0.3
    };

    const baseAllocation = baseAllocations[operation as keyof typeof baseAllocations] || 2000;
    const factor = degradationFactors[degradationLevel];
    const adjustedAllocation = Math.floor(baseAllocation * factor);
    
    return Math.min(adjustedAllocation, availableTokens);
  }
};