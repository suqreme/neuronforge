import { ClaudeAction, ClaudePlan, executeClaudeAction } from './ClaudePlanner';
import { useLogStore } from '../stores/logStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../stores/messageBus';
import { useMemoryStore } from '../stores/memoryStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { callClaudeWithActions } from '../utils/claudeApi';
import { withErrorRecovery, errorRecoveryManager, ErrorContext } from '../utils/errorRecovery';
import { ContextBuilders } from '../utils/promptContextBuilder';
import { parseAndApplyClaudeFiles, previewParsedFiles } from '../utils/parseClaudeFileResponse';
import { useTokenBudgetStore } from '../stores/tokenBudgetStore';

export interface AutoExecutionSettings {
  enableAutoExecution: boolean;
  autoExecuteTypes: string[];
  maxActionsPerRun: number;
  requireConfirmation: boolean;
  safeMode: boolean;
}

export interface WorkflowExecution {
  id: string;
  plan: ClaudePlan;
  currentActionIndex: number;
  startTime: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  parallelExecutions: Set<number>; // Indices of actions running in parallel
  completedActions: Set<number>;
  failedActions: Set<number>;
  resourcesInUse: Set<string>;
}

export interface ExecutionMetrics {
  totalExecuted: number;
  successful: number;
  failed: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
}

export const defaultAutoExecutionSettings: AutoExecutionSettings = {
  enableAutoExecution: false,
  autoExecuteTypes: ['ask_user'], // Only safe actions by default
  maxActionsPerRun: 3,
  requireConfirmation: true,
  safeMode: true
};

export class ClaudeAutoExecutor {
  private settings: AutoExecutionSettings;
  private executionQueue: ClaudeAction[] = [];
  private isExecuting: boolean = false;
  // Enhanced orchestration state
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();
  private resourceLocks: Set<string> = new Set();
  private executionMetrics: ExecutionMetrics = {
    totalExecuted: 0,
    successful: 0,
    failed: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  };

  constructor(settings: AutoExecutionSettings = defaultAutoExecutionSettings) {
    this.settings = settings;
  }

  // Update settings
  updateSettings(newSettings: Partial<AutoExecutionSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Auto-Executor',
      message: `Settings updated: Auto-execution ${this.settings.enableAutoExecution ? 'enabled' : 'disabled'}`
    });
  }

  // Add actions to execution queue
  queueActionsFromPlan(plan: ClaudePlan): number {
    if (!this.settings.enableAutoExecution) return 0;

    // Check token budget for auto-execution
    const tokenBudget = useTokenBudgetStore.getState();
    if (!tokenBudget.isAutoExecutionAllowed()) {
      const analytics = tokenBudget.getAnalytics();
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Auto-Executor',
        message: `🚫 Auto-execution blocked by token budget system (${Math.round(analytics.usagePercentage * 100)}% daily usage)`
      });
      return 0;
    }

    const executableActions = plan.actions
      .filter(action => this.isActionExecutable(action))
      .slice(0, this.settings.maxActionsPerRun);

    this.executionQueue.push(...executableActions);

    if (executableActions.length > 0) {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Auto-Executor',
        message: `Queued ${executableActions.length} actions for auto-execution`
      });

      // Start execution if not already running
      if (!this.isExecuting) {
        this.processQueue();
      }
    }

    return executableActions.length;
  }

  // Check if an action can be auto-executed
  private isActionExecutable(action: ClaudeAction): boolean {
    // Check if action type is in allowed list
    if (!this.settings.autoExecuteTypes.includes(action.type)) {
      return false;
    }

    // In safe mode, only allow very safe actions
    if (this.settings.safeMode) {
      const safeActions = ['ask_user', 'debug_issue'];
      return safeActions.includes(action.type);
    }

    // Additional safety checks
    switch (action.type) {
      case 'delete_file':
        // Never auto-delete in safe mode
        return !this.settings.safeMode;
      
      case 'improve_file':
      case 'create_file':
        // Only auto-execute file operations for certain safe paths
        if (action.target) {
          const safePaths = ['/src/components/', '/src/utils/', '/src/hooks/'];
          return safePaths.some(safePath => action.target!.startsWith(safePath));
        }
        return false;
      
      case 'ask_user':
        // Always safe to ask questions
        return true;
      
      case 'debug_issue':
        // Safe to analyze and report issues
        return true;
      
      default:
        return false;
    }
  }

  // Process the execution queue
  private async processQueue() {
    if (this.isExecuting || this.executionQueue.length === 0) return;

    this.isExecuting = true;
    
    try {
      while (this.executionQueue.length > 0) {
        const action = this.executionQueue.shift()!;
        
        useLogStore.getState().addLog({
          level: 'info',
          source: 'Claude Auto-Executor',
          message: `Executing action: ${action.type} - ${action.reason}`
        });

        // Send execution notification
        useMessageBus.getState().sendMessage(MessagePatterns.task(
          'CLAUDE_AUTO_EXECUTOR',
          'ALL',
          `Auto-executing: ${action.type} - ${action.reason}`,
          {
            actionType: action.type,
            target: action.target,
            autoExecution: true
          }
        ));

        try {
          const success = await this.executeActionWithEnhancements(action);
          
          if (success) {
            useMemoryStore.getState().addMemory(
              `Auto-executed action: ${action.type} for ${action.target || 'unknown target'}`,
              'auto_execution',
              {
                actionType: action.type,
                target: action.target,
                reason: action.reason,
                timestamp: Date.now()
              }
            );
          }

          // Wait a bit between executions to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          useLogStore.getState().addLog({
            level: 'error',
            source: 'Claude Auto-Executor',
            message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    } finally {
      this.isExecuting = false;
    }
  }

  // Enhanced action execution with additional logic
  private async executeActionWithEnhancements(action: ClaudeAction): Promise<boolean> {
    switch (action.type) {
      case 'ask_user':
        // For user questions, we can enhance them with context
        return await this.executeEnhancedUserQuestion(action);
      
      case 'create_file':
      case 'improve_file':
        // For file operations, we can add more detailed instructions
        return await this.executeEnhancedFileOperation(action);
      
      default:
        // Fallback to standard execution
        return await executeClaudeAction(action);
    }
  }

  // Enhanced user question with more context
  private async executeEnhancedUserQuestion(action: ClaudeAction): Promise<boolean> {
    try {
      // Get current project context for better questions
      const context = this.gatherQuestionContext();
      
      const enhancedQuestion = `${action.question}\n\nContext: ${context}`;
      
      useMessageBus.getState().sendMessage({
        sender: 'CLAUDE_AUTO_EXECUTOR',
        receiver: 'USER',
        type: 'request',
        content: enhancedQuestion,
        priority: 'high',
        metadata: {
          tags: ['auto-generated-question', 'enhanced'],
          originalQuestion: action.question,
          actionReason: action.reason
        }
      });

      return true;
    } catch (error) {
      console.error('Enhanced user question failed:', error);
      return false;
    }
  }

  // Enhanced file operation with Claude assistance and user feedback integration
  private async executeEnhancedFileOperation(action: ClaudeAction): Promise<boolean> {
    try {
      if (action.type === 'create_file' || action.type === 'improve_file') {
        // Get user feedback for this file before generating content
        const feedbackContext = this.getFeedbackContextForFile(action.target || '');
        
        // Use Claude to generate the actual file content with feedback integration
        const fileContent = await this.generateFileContent(action, feedbackContext);
        
        if (fileContent) {
          // Queue for diff review instead of direct creation
          useMessageBus.getState().sendMessage({
            sender: "CLAUDE_AUTO_EXECUTOR",
            receiver: "ALL",
            type: "file_update",
            content: `Generated content for ${action.type}: ${action.reason}`,
            priority: "medium",
            metadata: {
              filePath: action.target || "unknown",
              actionType: action.type,
              generatedContent: fileContent,
              needsReview: true,
              tags: ["file-change"]
            }
          });
          
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Enhanced file operation failed:', error);
      return false;
    }
  }

  // Generate file content using Claude with token-safe context and user feedback integration
  private async generateFileContent(action: ClaudeAction, feedbackContext?: string): Promise<string | null> {
    return withErrorRecovery(
      'ClaudeAutoExecutor',
      'generateFileContent',
      async () => {
        // Build token-safe context for file generation
        const targetFiles = action.target ? [action.target] : [];
        const taskDescription = `${action.type === 'create_file' ? 'Create a new' : 'Improve the existing'} file: ${action.target}. Reason: ${action.reason}`;
        
        const contextResult = ContextBuilders.fileGeneration(taskDescription, targetFiles);
        
        // Log context usage
        useLogStore.getState().addLog({
          level: 'info',
          source: 'Claude Auto Executor',
          message: `📝 File generation context: ${contextResult.tokenCount} tokens, ${contextResult.stats.feedbacksIncluded} user feedbacks prioritized`
        });
        
        // Log warnings if any
        if (contextResult.warnings.length > 0) {
          contextResult.warnings.forEach(warning => {
            useLogStore.getState().addLog({
              level: 'warn',
              source: 'Claude Auto Executor',
              message: `⚠️ Context warning: ${warning}`
            });
          });
        }

        const prompt = `You are an expert code generator for NeuronForge. Generate high-quality, production-ready code.

${contextResult.context}

GENERATION REQUIREMENTS:
- Use TypeScript if it's a .ts or .tsx file
- Follow project conventions shown in context
- Include proper imports and exports
- Add appropriate comments
- Make it production-ready
- PRIORITIZE addressing any user feedback issues first

You may generate multiple related files in one response using the multi-file format shown in the context.

Return the file content(s) using the specified multi-file format.`;

        const response = await callClaudeWithActions(prompt, [], {
          includeFiles: false, // Context already included in prompt
          includeProjectState: false, // Context already included in prompt
          enableActions: false
        });

        if (response.type === 'message' && response.content) {
          // Check for multi-file response format
          const { parseResult, applyResult } = parseAndApplyClaudeFiles(response.content, 'CLAUDE_AUTO_EXECUTOR', {
            maxFiles: 5,
            maxFileSize: 30000,
            logParsing: true
          });

          if (parseResult.success && parseResult.files.length > 0) {
            useLogStore.getState().addLog({
              level: 'success',
              source: 'Claude Auto Executor',
              message: `📄 Generated ${parseResult.files.length} files from multi-file response: ${parseResult.files.map(f => f.path).join(', ')}`
            });

            // Send multi-file update notification
            useMessageBus.getState().sendMessage({
              sender: 'CLAUDE_AUTO_EXECUTOR',
              receiver: 'ALL',
              type: 'multi_file_update',
              content: previewParsedFiles(parseResult),
              priority: 'high',
              metadata: {
                tags: ['file-generation', 'multi-file', 'auto-executor'],
                fileCount: parseResult.files.length,
                totalSize: parseResult.totalSize,
                filePaths: parseResult.files.map(f => f.path),
                actionType: action.type,
                actionTarget: action.target
              }
            });

            // Return the first file's content for compatibility, or a summary
            if (parseResult.files.length === 1) {
              return parseResult.files[0].content;
            } else {
              return `// Multi-file response generated ${parseResult.files.length} files:\n${parseResult.files.map(f => `// - ${f.path} (${f.size} chars)`).join('\n')}`;
            }
          } else {
            // Single file response - return as-is
            return response.content;
          }
        }

        return null;
      },
      {
        actionType: action.type,
        target: action.target,
        reason: action.reason
      }
    ).catch(error => {
      console.error('File content generation failed:', error);
      return null;
    });
  }

  // Get user feedback context for a specific file
  private getFeedbackContextForFile(filePath: string): string {
    try {
      if (!filePath) return '';
      
      const feedbackStore = useFeedbackStore.getState();
      const fileFeedbacks = feedbackStore.getFeedbacksForTarget(filePath);
      
      if (fileFeedbacks.length === 0) {
        return '';
      }
      
      const feedbackContext = feedbackStore.getFeedbackContextForTarget(filePath);
      
      // Log that we're using feedback context
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Auto Executor',
        message: `📥 Applying user feedback context for ${filePath} (${fileFeedbacks.length} feedback entries)`
      });
      
      return feedbackContext;
    } catch (error) {
      console.error('Failed to get feedback context:', error);
      return '';
    }
  }

  // Gather context for better user questions
  private gatherQuestionContext(): string {
    try {
      const { useFileContext } = require('../stores/fileContextStore');
      const fileStats = useFileContext.getState().getFileStats();
      const recentMessages = useMessageBus.getState().getRecentMessages(5);
      
      return `
Project has ${fileStats.totalFiles} files (${fileStats.totalLines} lines).
Languages: ${Object.keys(fileStats.languageBreakdown).join(', ')}.
Recent activity: ${recentMessages.length} messages in message bus.
`.trim();
    } catch (error) {
      return 'Unable to gather context due to error.';
    }
  }

  // Get current execution status
  getStatus() {
    return {
      isExecuting: this.isExecuting,
      queueLength: this.executionQueue.length,
      settings: this.settings
    };
  }

  // Clear execution queue
  clearQueue() {
    this.executionQueue = [];
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Auto-Executor',
      message: 'Execution queue cleared'
    });
  }

  // Stop current execution
  stop() {
    this.isExecuting = false;
    this.clearQueue();
    // Stop all active workflows
    this.activeWorkflows.forEach(workflow => {
      workflow.status = 'paused';
    });
    this.resourceLocks.clear();
    useLogStore.getState().addLog({
      level: 'warn',
      source: 'Claude Auto-Executor',
      message: 'Auto-execution stopped'
    });
  }

  // ===== ENHANCED ORCHESTRATION METHODS =====

  /**
   * Executes an orchestrated plan with advanced workflow management
   */
  async executeOrchestrationPlan(plan: ClaudePlan): Promise<string> {
    return withErrorRecovery(
      'ClaudeAutoExecutor',
      'executeOrchestrationPlan',
      async () => {
        if (!this.settings.enableAutoExecution) {
          throw new Error('Auto-execution is disabled');
        }

        const workflowId = crypto.randomUUID();
        const workflow: WorkflowExecution = {
          id: workflowId,
          plan,
          currentActionIndex: 0,
          startTime: Date.now(),
          status: 'running',
          parallelExecutions: new Set(),
          completedActions: new Set(),
          failedActions: new Set(),
          resourcesInUse: new Set()
        };

        this.activeWorkflows.set(workflowId, workflow);

        useLogStore.getState().addLog({
          level: 'info',
          source: 'Claude Auto-Executor',
          message: `🚀 Starting orchestrated workflow: ${plan.actions.length} actions, ${plan.orchestration.executionStrategy} strategy`
        });

        try {
          const result = await this.executeWorkflow(workflow);
          workflow.status = 'completed';
          
          // Update metrics
          this.executionMetrics.totalExecuted += plan.actions.length;
          this.executionMetrics.successful += workflow.completedActions.size;
          this.executionMetrics.failed += workflow.failedActions.size;
          this.executionMetrics.lastExecutionTime = Date.now() - workflow.startTime;
          
          return result;
        } catch (error) {
          workflow.status = 'failed';
          throw error;
        } finally {
          this.activeWorkflows.delete(workflowId);
          // Release resources
          workflow.resourcesInUse.forEach(resource => {
            this.resourceLocks.delete(resource);
          });
        }
      },
      {
        planId: plan.timestamp.toString(),
        actionCount: plan.actions.length,
        strategy: plan.orchestration.executionStrategy
      }
    );
  }

  /**
   * Executes a workflow based on its orchestration strategy
   */
  private async executeWorkflow(workflow: WorkflowExecution): Promise<string> {
    const { plan } = workflow;
    const results: string[] = [];

    switch (plan.orchestration.executionStrategy) {
      case 'sequential':
        return await this.executeSequential(workflow);
      
      case 'parallel':
        return await this.executeParallel(workflow);
        
      case 'mixed':
        return await this.executeMixed(workflow);
        
      default:
        return await this.executeSequential(workflow);
    }
  }

  /**
   * Sequential execution strategy
   */
  private async executeSequential(workflow: WorkflowExecution): Promise<string> {
    const results: string[] = [];
    
    for (let i = 0; i < workflow.plan.actions.length; i++) {
      if (workflow.status !== 'running') break;
      
      const action = workflow.plan.actions[i];
      workflow.currentActionIndex = i;
      
      // Check dependencies
      if (!this.areDependenciesMet(action, workflow)) {
        workflow.failedActions.add(i);
        results.push(`Action ${i} failed: Dependencies not met`);
        continue;
      }
      
      // Reserve resources
      const resourcesReserved = this.reserveResources(action, workflow);
      if (!resourcesReserved) {
        workflow.failedActions.add(i);
        results.push(`Action ${i} failed: Resources unavailable`);
        continue;
      }
      
      try {
        const success = await this.executeActionWithEnhancements(action);
        if (success) {
          workflow.completedActions.add(i);
          results.push(`Action ${i} completed successfully`);
        } else {
          workflow.failedActions.add(i);
          results.push(`Action ${i} failed during execution`);
        }
      } catch (error) {
        workflow.failedActions.add(i);
        results.push(`Action ${i} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Release resources
      this.releaseResources(action, workflow);
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results.join('\n');
  }

  /**
   * Parallel execution strategy
   */
  private async executeParallel(workflow: WorkflowExecution): Promise<string> {
    const promises: Promise<{ index: number; result: string }>[] = [];
    
    workflow.plan.actions.forEach((action, index) => {
      if (action.coordination?.parallel) {
        workflow.parallelExecutions.add(index);
        promises.push(this.executeActionAsync(action, index, workflow));
      }
    });
    
    const results = await Promise.allSettled(promises);
    return results.map((result, index) => 
      result.status === 'fulfilled' 
        ? result.value.result 
        : `Action ${index} failed: ${result.reason}`
    ).join('\n');
  }

  /**
   * Mixed execution strategy (parallel where possible, sequential where needed)
   */
  private async executeMixed(workflow: WorkflowExecution): Promise<string> {
    const results: string[] = [];
    const parallelGroups = workflow.plan.orchestration.parallelGroups || [];
    
    if (parallelGroups.length === 0) {
      // Fall back to sequential
      return await this.executeSequential(workflow);
    }
    
    for (const group of parallelGroups) {
      const groupPromises = group.map(actionId => {
        const index = parseInt(actionId.replace('action_', ''));
        const action = workflow.plan.actions[index];
        return this.executeActionAsync(action, index, workflow);
      });
      
      const groupResults = await Promise.allSettled(groupPromises);
      results.push(...groupResults.map((result, index) => 
        result.status === 'fulfilled' 
          ? result.value.result 
          : `Group action ${index} failed: ${result.reason}`
      ));
      
      // Small delay between groups
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results.join('\n');
  }

  /**
   * Execute an action asynchronously
   */
  private async executeActionAsync(
    action: ClaudeAction, 
    index: number, 
    workflow: WorkflowExecution
  ): Promise<{ index: number; result: string }> {
    try {
      // Check dependencies
      if (!this.areDependenciesMet(action, workflow)) {
        workflow.failedActions.add(index);
        return { index, result: `Action ${index} failed: Dependencies not met` };
      }
      
      // Reserve resources
      const resourcesReserved = this.reserveResources(action, workflow);
      if (!resourcesReserved) {
        workflow.failedActions.add(index);
        return { index, result: `Action ${index} failed: Resources unavailable` };
      }
      
      const success = await this.executeActionWithEnhancements(action);
      
      if (success) {
        workflow.completedActions.add(index);
        return { index, result: `Action ${index} completed successfully` };
      } else {
        workflow.failedActions.add(index);
        return { index, result: `Action ${index} failed during execution` };
      }
    } catch (error) {
      workflow.failedActions.add(index);
      return { index, result: `Action ${index} error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    } finally {
      this.releaseResources(action, workflow);
    }
  }

  /**
   * Check if action dependencies are met
   */
  private areDependenciesMet(action: ClaudeAction, workflow: WorkflowExecution): boolean {
    const dependencies = action.dependencies || [];
    return dependencies.every(depId => {
      const depIndex = parseInt(depId.replace('action_', ''));
      return workflow.completedActions.has(depIndex);
    });
  }

  /**
   * Reserve resources for action execution
   */
  private reserveResources(action: ClaudeAction, workflow: WorkflowExecution): boolean {
    const resources = action.coordination?.resources || [];
    
    // Check if any required resources are locked
    for (const resource of resources) {
      if (this.resourceLocks.has(resource)) {
        return false;
      }
    }
    
    // Reserve resources
    resources.forEach(resource => {
      this.resourceLocks.add(resource);
      workflow.resourcesInUse.add(resource);
    });
    
    return true;
  }

  /**
   * Release resources after action execution
   */
  private releaseResources(action: ClaudeAction, workflow: WorkflowExecution): void {
    const resources = action.coordination?.resources || [];
    resources.forEach(resource => {
      this.resourceLocks.delete(resource);
      workflow.resourcesInUse.delete(resource);
    });
  }

  /**
   * Get current orchestration metrics
   */
  getOrchestrationMetrics(): ExecutionMetrics & { activeWorkflows: number } {
    return {
      ...this.executionMetrics,
      activeWorkflows: this.activeWorkflows.size
    };
  }

  /**
   * Get status of all active workflows
   */
  getActiveWorkflows(): Array<{
    id: string;
    status: string;
    progress: number;
    estimatedTimeRemaining: number;
  }> {
    return Array.from(this.activeWorkflows.values()).map(workflow => ({
      id: workflow.id,
      status: workflow.status,
      progress: workflow.completedActions.size / workflow.plan.actions.length,
      estimatedTimeRemaining: this.estimateTimeRemaining(workflow)
    }));
  }

  /**
   * Estimate remaining execution time for a workflow
   */
  private estimateTimeRemaining(workflow: WorkflowExecution): number {
    const elapsed = Date.now() - workflow.startTime;
    const progress = workflow.completedActions.size / workflow.plan.actions.length;
    
    if (progress === 0) return workflow.plan.orchestration.estimatedDuration * 60 * 1000;
    
    const estimatedTotal = elapsed / progress;
    return Math.max(0, estimatedTotal - elapsed);
  }
}

// Global instance
export const claudeAutoExecutor = new ClaudeAutoExecutor();