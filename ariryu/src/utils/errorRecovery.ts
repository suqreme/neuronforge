import React from 'react';
import { useLogStore } from '../stores/logStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { useMemoryStore } from '../stores/memoryStore';

export interface ErrorContext {
  component: string;
  operation: string;
  error: Error;
  timestamp: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: ErrorContext) => boolean;
  recover: (error: ErrorContext) => Promise<boolean>;
  maxRetries: number;
  backoffMs: number;
}

export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private errorHistory = new Map<string, ErrorContext[]>();
  private activeRecoveries = new Set<string>();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies() {
    // Network timeout recovery
    this.addStrategy({
      name: 'Network Timeout Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('timeout') || 
        ctx.error.message.includes('ETIMEDOUT') ||
        ctx.error.message.includes('network'),
      recover: async (ctx) => {
        await this.delay(ctx.retryCount ? ctx.retryCount * 2000 : 1000);
        return true; // Allow retry
      },
      maxRetries: 3,
      backoffMs: 2000
    });

    // API quota/rate limit recovery
    this.addStrategy({
      name: 'API Rate Limit Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('rate limit') || 
        ctx.error.message.includes('quota') ||
        ctx.error.message.includes('429'),
      recover: async (ctx) => {
        const waitTime = Math.min(60000, (ctx.retryCount || 1) * 15000); // Max 1 minute
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Error Recovery',
          message: `Rate limited. Waiting ${waitTime/1000}s before retry...`
        });
        await this.delay(waitTime);
        return true;
      },
      maxRetries: 5,
      backoffMs: 15000
    });

    // Authentication/API key recovery
    this.addStrategy({
      name: 'Authentication Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('unauthorized') || 
        ctx.error.message.includes('invalid API key') ||
        ctx.error.message.includes('403') ||
        ctx.error.message.includes('401'),
      recover: async (ctx) => {
        useLogStore.getState().addLog({
          level: 'error',
          source: 'Error Recovery',
          message: 'Authentication failed. Please check your API configuration.'
        });
        
        useMessageBus.getState().sendMessage(MessagePatterns.log(
          'ERROR_RECOVERY',
          'Authentication error detected. Please verify API key configuration.',
          ['error', 'auth', 'recovery']
        ));
        
        return false; // Don't retry auth errors automatically
      },
      maxRetries: 1,
      backoffMs: 0
    });

    // Memory/resource exhaustion recovery
    this.addStrategy({
      name: 'Resource Exhaustion Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('out of memory') || 
        ctx.error.message.includes('heap') ||
        ctx.error.message.includes('stack overflow'),
      recover: async (ctx) => {
        // Attempt to clear some memory
        this.clearCaches();
        await this.delay(5000); // Give system time to recover
        return ctx.retryCount && ctx.retryCount < 2; // Only retry once
      },
      maxRetries: 1,
      backoffMs: 5000
    });

    // JSON parsing recovery
    this.addStrategy({
      name: 'JSON Parse Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('JSON') || 
        ctx.error.message.includes('parse') ||
        ctx.error.message.includes('syntax'),
      recover: async (ctx) => {
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Error Recovery',
          message: `JSON parsing failed in ${ctx.component}. Attempting data sanitization...`
        });
        return false; // Let the component handle data sanitization
      },
      maxRetries: 1,
      backoffMs: 1000
    });

    // File system recovery
    this.addStrategy({
      name: 'File System Recovery',
      condition: (ctx) => 
        ctx.error.message.includes('ENOENT') || 
        ctx.error.message.includes('EACCES') ||
        ctx.error.message.includes('file'),
      recover: async (ctx) => {
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Error Recovery',
          message: `File system error in ${ctx.component}. Checking file permissions...`
        });
        await this.delay(1000);
        return true; // Allow one retry
      },
      maxRetries: 2,
      backoffMs: 1000
    });
  }

  addStrategy(strategy: RecoveryStrategy) {
    this.strategies.push(strategy);
  }

  async handleError(context: ErrorContext): Promise<boolean> {
    const errorKey = `${context.component}-${context.operation}`;
    
    // Track error history
    if (!this.errorHistory.has(errorKey)) {
      this.errorHistory.set(errorKey, []);
    }
    this.errorHistory.get(errorKey)!.push(context);

    // Prevent concurrent recoveries for the same error
    if (this.activeRecoveries.has(errorKey)) {
      return false;
    }

    this.activeRecoveries.add(errorKey);

    try {
      // Find applicable strategy
      const strategy = this.strategies.find(s => s.condition(context));
      
      if (!strategy) {
        this.logUnhandledError(context);
        return false;
      }

      // Check retry limits
      const retryCount = context.retryCount || 0;
      if (retryCount >= strategy.maxRetries) {
        this.logMaxRetriesExceeded(context, strategy);
        return false;
      }

      useLogStore.getState().addLog({
        level: 'info',
        source: 'Error Recovery',
        message: `Applying strategy "${strategy.name}" for ${context.component} (attempt ${retryCount + 1}/${strategy.maxRetries})`
      });

      // Apply recovery strategy
      const shouldRetry = await strategy.recover(context);

      if (shouldRetry) {
        // Store recovery attempt in memory
        useMemoryStore.getState().addMemory(
          `Error recovery applied: ${strategy.name} for ${context.component}`,
          'error_recovery',
          {
            component: context.component,
            operation: context.operation,
            strategy: strategy.name,
            retryCount: retryCount + 1,
            timestamp: Date.now(),
            tags: ['error-recovery', 'retry']
          }
        );
      }

      return shouldRetry;
    } catch (recoveryError) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Error Recovery',
        message: `Recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`
      });
      return false;
    } finally {
      this.activeRecoveries.delete(errorKey);
    }
  }

  private logUnhandledError(context: ErrorContext) {
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Error Recovery',
      message: `No recovery strategy found for ${context.component}: ${context.error.message}`
    });

    useMessageBus.getState().sendMessage(MessagePatterns.log(
      'ERROR_RECOVERY',
      `Unhandled error in ${context.component}: ${context.error.message}`,
      ['error', 'unhandled', context.component]
    ));
  }

  private logMaxRetriesExceeded(context: ErrorContext, strategy: RecoveryStrategy) {
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Error Recovery',
      message: `Max retries (${strategy.maxRetries}) exceeded for ${context.component} using "${strategy.name}"`
    });

    useMemoryStore.getState().addMemory(
      `Error recovery failed: Max retries exceeded for ${context.component}`,
      'error_recovery',
      {
        component: context.component,
        operation: context.operation,
        strategy: strategy.name,
        maxRetries: strategy.maxRetries,
        finalError: context.error.message,
        timestamp: Date.now(),
        tags: ['error-recovery', 'failed', 'max-retries']
      }
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearCaches() {
    try {
      // Clear memory store cache if it exists
      const memoryStore = useMemoryStore.getState();
      if ('clearOldMemories' in memoryStore && typeof memoryStore.clearOldMemories === 'function') {
        memoryStore.clearOldMemories();
      }

      // Clear message bus old messages
      const messageBus = useMessageBus.getState();
      if ('clearOldMessages' in messageBus && typeof messageBus.clearOldMessages === 'function') {
        messageBus.clearOldMessages();
      }

      useLogStore.getState().addLog({
        level: 'info',
        source: 'Error Recovery',
        message: 'Cleared system caches to free memory'
      });
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Error Recovery',
        message: `Failed to clear caches: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  getErrorStats(): {
    totalErrors: number;
    errorsByComponent: Record<string, number>;
    recentErrors: ErrorContext[];
    topErrors: Array<{ error: string; count: number }>;
  } {
    const allErrors: ErrorContext[] = [];
    this.errorHistory.forEach(errors => allErrors.push(...errors));

    const errorsByComponent: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    allErrors.forEach(error => {
      errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
      errorCounts[error.error.message] = (errorCounts[error.error.message] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    const recentErrors = allErrors
      .filter(error => Date.now() - error.timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      totalErrors: allErrors.length,
      errorsByComponent,
      recentErrors,
      topErrors
    };
  }

  clearErrorHistory() {
    this.errorHistory.clear();
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Error Recovery',
      message: 'Error history cleared'
    });
  }
}

// Global error recovery instance
export const errorRecoveryManager = new ErrorRecoveryManager();

// Utility function for wrapping operations with error recovery
export async function withErrorRecovery<T>(
  component: string,
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      const errorContext: ErrorContext = {
        component,
        operation,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
        retryCount,
        metadata
      };

      if (retryCount >= maxRetries) {
        // Final attempt failed, log and throw
        useLogStore.getState().addLog({
          level: 'error',
          source: 'Error Recovery',
          message: `Operation "${operation}" in ${component} failed after ${maxRetries} retries: ${errorContext.error.message}`
        });
        throw error;
      }

      const shouldRetry = await errorRecoveryManager.handleError(errorContext);
      
      if (!shouldRetry) {
        throw error;
      }

      retryCount++;
    }
  }

  throw new Error('This should never be reached');
}

// Error boundary creator function
export function createErrorBoundary(componentName: string) {
  return {
    componentName,
    
    // Create error boundary component
    ErrorBoundary: class extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; error?: Error }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const errorContext: ErrorContext = {
          component: componentName,
          operation: 'render',
          error,
          timestamp: Date.now(),
          metadata: { errorInfo }
        };

        errorRecoveryManager.handleError(errorContext);
      }

      render() {
        if (this.state.hasError) {
          return React.createElement('div', {
            className: 'p-4 bg-red-900 border border-red-700 rounded-lg text-white'
          }, [
            React.createElement('h3', {
              key: 'title',
              className: 'text-lg font-semibold mb-2'
            }, '⚠️ Component Error'),
            React.createElement('p', {
              key: 'message',
              className: 'text-sm text-red-200 mb-2'
            }, `The ${componentName} component encountered an error.`),
            React.createElement('details', {
              key: 'details',
              className: 'text-xs text-red-300'
            }, [
              React.createElement('summary', {
                key: 'summary',
                className: 'cursor-pointer'
              }, 'Error Details'),
              React.createElement('pre', {
                key: 'error',
                className: 'mt-2 whitespace-pre-wrap'
              }, this.state.error?.message || 'Unknown error')
            ]),
            React.createElement('button', {
              key: 'retry',
              onClick: () => this.setState({ hasError: false, error: undefined }),
              className: 'mt-3 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm'
            }, '🔄 Retry')
          ]);
        }

        return this.props.children;
      }
    }
  };
}