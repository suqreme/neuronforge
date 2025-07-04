import { useTokenBudgetStore } from '../stores/tokenBudgetStore';
import { useLogStore } from '../stores/logStore';
import { useMessageBus } from '../stores/messageBus';

/**
 * Emergency shutdown and recovery manager for token budget system
 */
export class TokenBudgetManager {
  private static instance: TokenBudgetManager;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private shutdownCallbacks: Array<() => void> = [];
  private recoveryCallbacks: Array<() => void> = [];

  static getInstance(): TokenBudgetManager {
    if (!TokenBudgetManager.instance) {
      TokenBudgetManager.instance = new TokenBudgetManager();
    }
    return TokenBudgetManager.instance;
  }

  private constructor() {
    this.initializeRecoverySystem();
    this.setupUsageMonitoring();
  }

  /**
   * Initialize the automatic recovery system
   */
  private initializeRecoverySystem() {
    // Check for recovery every 5 minutes
    this.recoveryInterval = setInterval(() => {
      this.checkForRecovery();
    }, 5 * 60 * 1000);
  }

  /**
   * Setup real-time usage monitoring for emergency triggers
   */
  private setupUsageMonitoring() {
    // Monitor token budget store changes
    let lastUsage = 0;
    let lastStatus = 'normal';

    const checkUsage = () => {
      const tokenBudget = useTokenBudgetStore.getState();
      const analytics = tokenBudget.getAnalytics();
      const currentUsage = analytics.usageToday;
      const currentStatus = analytics.status;

      // Check for emergency shutdown conditions
      if (currentStatus === 'critical' && lastStatus !== 'critical') {
        this.handleCriticalThreshold();
      }

      if (currentStatus === 'emergency' && lastStatus !== 'emergency') {
        this.handleEmergencyShutdown();
      }

      // Check for recovery conditions
      if (currentStatus === 'normal' && lastStatus !== 'normal') {
        this.handleRecovery();
      }

      lastUsage = currentUsage;
      lastStatus = currentStatus;
    };

    // Check every 30 seconds
    setInterval(checkUsage, 30000);
  }

  /**
   * Handle critical threshold reached (95%+)
   */
  private handleCriticalThreshold() {
    const tokenBudget = useTokenBudgetStore.getState();
    const analytics = tokenBudget.getAnalytics();

    useLogStore.getState().addLog({
      level: 'error',
      source: 'Token Budget Manager',
      message: `🚨 CRITICAL: Token usage at ${Math.round(analytics.usagePercentage * 100)}% - Emergency protocols activated`
    });

    useMessageBus.getState().sendMessage({
      sender: 'TOKEN_BUDGET_MANAGER',
      receiver: 'ALL',
      type: 'emergency_alert',
      content: `CRITICAL TOKEN USAGE: ${Math.round(analytics.usagePercentage * 100)}% of daily limit reached`,
      priority: 'critical',
      metadata: {
        tags: ['emergency', 'token-budget', 'critical-threshold'],
        usagePercentage: analytics.usagePercentage,
        remainingTokens: analytics.usageToday - tokenBudget.config.dailyLimit,
        emergencyShutdownPending: true
      }
    });

    // Auto-trigger emergency shutdown if enabled and usage exceeds critical threshold
    if (tokenBudget.config.emergencyShutdownEnabled && analytics.usagePercentage >= tokenBudget.config.criticalThreshold) {
      setTimeout(() => {
        this.triggerEmergencyShutdown('Automatic shutdown due to critical token usage');
      }, 10000); // 10 second grace period
    }
  }

  /**
   * Handle emergency shutdown activation
   */
  private handleEmergencyShutdown() {
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Token Budget Manager',
      message: '🚨 EMERGENCY SHUTDOWN ACTIVATED - All AI operations disabled'
    });

    useMessageBus.getState().sendMessage({
      sender: 'TOKEN_BUDGET_MANAGER',
      receiver: 'ALL',
      type: 'emergency_shutdown',
      content: 'EMERGENCY SHUTDOWN: All AI operations have been disabled due to token budget limits',
      priority: 'critical',
      metadata: {
        tags: ['emergency', 'shutdown', 'token-budget'],
        shutdownTime: Date.now(),
        shutdownReason: 'Token budget exceeded critical threshold'
      }
    });

    // Execute shutdown callbacks
    this.shutdownCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error executing shutdown callback:', error);
      }
    });
  }

  /**
   * Handle recovery from emergency state
   */
  private handleRecovery() {
    useLogStore.getState().addLog({
      level: 'success',
      source: 'Token Budget Manager',
      message: '✅ Token budget recovered - AI operations re-enabled'
    });

    useMessageBus.getState().sendMessage({
      sender: 'TOKEN_BUDGET_MANAGER',
      receiver: 'ALL',
      type: 'recovery_complete',
      content: 'Token budget system recovered - AI operations are now available',
      priority: 'high',
      metadata: {
        tags: ['recovery', 'token-budget', 'system-restored'],
        recoveryTime: Date.now()
      }
    });

    // Execute recovery callbacks
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error executing recovery callback:', error);
      }
    });
  }

  /**
   * Check for automatic recovery conditions
   */
  private checkForRecovery() {
    const tokenBudget = useTokenBudgetStore.getState();
    const analytics = tokenBudget.getAnalytics();

    // Auto-recovery if usage drops below warning threshold and shutdown is active
    if (tokenBudget.usage.isEmergencyShutdown && analytics.usagePercentage < tokenBudget.config.warningThreshold) {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Token Budget Manager',
        message: `🔄 Auto-recovery triggered: Usage dropped to ${Math.round(analytics.usagePercentage * 100)}%`
      });

      tokenBudget.clearEmergencyShutdown();
      this.handleRecovery();
    }

    // Auto-reset if reset time has passed
    if (Date.now() >= tokenBudget.usage.resetTime) {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Token Budget Manager',
        message: '🔄 Daily token budget reset - All systems restored'
      });

      tokenBudget.resetDailyUsage();
      this.handleRecovery();
    }
  }

  /**
   * Manually trigger emergency shutdown
   */
  triggerEmergencyShutdown(reason: string = 'Manual emergency shutdown') {
    const tokenBudget = useTokenBudgetStore.getState();
    
    useLogStore.getState().addLog({
      level: 'warn',
      source: 'Token Budget Manager',
      message: `🚨 Manual emergency shutdown triggered: ${reason}`
    });

    tokenBudget.triggerEmergencyShutdown();
    this.handleEmergencyShutdown();
  }

  /**
   * Manually clear emergency shutdown
   */
  clearEmergencyShutdown(reason: string = 'Manual recovery') {
    const tokenBudget = useTokenBudgetStore.getState();
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Token Budget Manager',
      message: `✅ Emergency shutdown cleared: ${reason}`
    });

    tokenBudget.clearEmergencyShutdown();
    this.handleRecovery();
  }

  /**
   * Register callback for emergency shutdown events
   */
  onEmergencyShutdown(callback: () => void) {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Register callback for recovery events
   */
  onRecovery(callback: () => void) {
    this.recoveryCallbacks.push(callback);
  }

  /**
   * Remove shutdown callback
   */
  offEmergencyShutdown(callback: () => void) {
    const index = this.shutdownCallbacks.indexOf(callback);
    if (index > -1) {
      this.shutdownCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove recovery callback
   */
  offRecovery(callback: () => void) {
    const index = this.recoveryCallbacks.indexOf(callback);
    if (index > -1) {
      this.recoveryCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    const tokenBudget = useTokenBudgetStore.getState();
    const analytics = tokenBudget.getAnalytics();

    return {
      status: analytics.status,
      isEmergencyShutdown: tokenBudget.usage.isEmergencyShutdown,
      degradationLevel: tokenBudget.getDegradationLevel(),
      usagePercentage: analytics.usagePercentage,
      timeUntilReset: tokenBudget.getTimeUntilReset(),
      shutdownCallbackCount: this.shutdownCallbacks.length,
      recoveryCallbackCount: this.recoveryCallbacks.length
    };
  }

  /**
   * Force a token budget check and apply appropriate actions
   */
  forceCheck() {
    const tokenBudget = useTokenBudgetStore.getState();
    const analytics = tokenBudget.getAnalytics();

    if (analytics.status === 'emergency' && !tokenBudget.usage.isEmergencyShutdown) {
      this.handleEmergencyShutdown();
    } else if (analytics.status === 'critical') {
      this.handleCriticalThreshold();
    } else if (analytics.status === 'normal' && tokenBudget.usage.isEmergencyShutdown) {
      this.handleRecovery();
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
    this.shutdownCallbacks = [];
    this.recoveryCallbacks = [];
  }
}

// Global instance
export const tokenBudgetManager = TokenBudgetManager.getInstance();

/**
 * Hook for components to interact with token budget manager
 */
export function useTokenBudgetManager() {
  return {
    manager: tokenBudgetManager,
    getSystemStatus: () => tokenBudgetManager.getSystemStatus(),
    triggerEmergencyShutdown: (reason?: string) => tokenBudgetManager.triggerEmergencyShutdown(reason),
    clearEmergencyShutdown: (reason?: string) => tokenBudgetManager.clearEmergencyShutdown(reason),
    forceCheck: () => tokenBudgetManager.forceCheck(),
    onEmergencyShutdown: (callback: () => void) => tokenBudgetManager.onEmergencyShutdown(callback),
    onRecovery: (callback: () => void) => tokenBudgetManager.onRecovery(callback),
    offEmergencyShutdown: (callback: () => void) => tokenBudgetManager.offEmergencyShutdown(callback),
    offRecovery: (callback: () => void) => tokenBudgetManager.offRecovery(callback)
  };
}