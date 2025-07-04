import { useFileContext, FileRecord } from '../stores/fileContextStore';
import { useMessageBus, AgentMessage } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';
import { useMemoryStore } from '../stores/memoryStore';
import { callClaudeWithContext } from '../utils/claudeApi';
import { getMemoryContextForClaude, useMemorySummary } from '../utils/memorySummarizer';
import { useSelfCritiqueStore } from '../stores/selfCritiqueStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { ContextBuilders } from '../utils/promptContextBuilder';
import { parseAndApplyClaudeFiles, previewParsedFiles } from '../utils/parseClaudeFileResponse';
import { useTokenBudgetStore } from '../stores/tokenBudgetStore';

export interface ClaudeAction {
  type: 'improve_file' | 'create_file' | 'delete_file' | 'ask_user' | 'debug_issue' | 'add_feature' | 'spawn_agent' | 'coordinate_agents' | 'analyze_dependencies' | 'generate_tests';
  target?: string;
  question?: string;
  reason: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedTime?: string;
  // Enhanced orchestration fields
  dependencies?: string[]; // Actions this depends on
  agentType?: string; // For spawn_agent actions
  coordination?: {
    parallel?: boolean; // Can run in parallel with other actions
    resources?: string[]; // Resources needed (files, APIs, etc.)
    constraints?: string[]; // Constraints or requirements
  };
  confidence?: number; // AI confidence in this action (0-1)
  impact?: 'low' | 'medium' | 'high'; // Expected impact on project
}

export interface ClaudePlan {
  actions: ClaudeAction[];
  analysis: string;
  confidence: number;
  timestamp: number;
  // Enhanced orchestration metadata
  orchestration: {
    executionStrategy: 'sequential' | 'parallel' | 'mixed';
    estimatedDuration: number; // Total estimated time in minutes
    resourceRequirements: string[]; // Files, APIs, agents needed
    riskAssessment: 'low' | 'medium' | 'high';
    dependencies: { [actionId: string]: string[] }; // Action dependency graph
    parallelGroups: string[][]; // Groups of actions that can run in parallel
  };
  qualityMetrics: {
    planCompleteness: number; // 0-1 score
    actionCohesion: number; // How well actions work together
    implementationFeasibility: number; // How realistic the plan is
  };
}

export async function runClaudePlanner(): Promise<ClaudePlan> {
  const { getAllFiles, getRecentChanges, getFileStats } = useFileContext.getState();
  const { getRecentMessages } = useMessageBus.getState();
  const { logs } = useLogStore.getState();
  const { getRecentMemory } = useMemoryStore.getState();

  // Check token budget and degradation level first
  const tokenBudget = useTokenBudgetStore.getState();
  if (!tokenBudget.isPlanningAllowed()) {
    const analytics = tokenBudget.getAnalytics();
    useLogStore.getState().addLog({
      level: 'warn',
      source: 'Claude Planner',
      message: `🚫 Planning blocked by token budget system (${Math.round(analytics.usagePercentage * 100)}% daily usage)`
    });
    throw new Error(`Planning operations disabled due to token budget constraints (${analytics.status} level)`);
  }

  try {
    // Gather current state
    const files = getAllFiles(); // Keep as Record<string, FileRecord>
    const recentChanges = getRecentChanges(10);
    const recentMessages = getRecentMessages(15);
    const recentLogs = logs.slice(-20);
    const fileStats = getFileStats();
    const memories = getRecentMemory(10);

    // Estimate token usage and check budget
    const estimatedTokens = 5000; // Base estimation for planning
    const operationResult = tokenBudget.checkOperationAllowed(estimatedTokens, 'planning');
    
    if (!operationResult.allowed) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Planner',
        message: `🚫 Planning operation blocked: ${operationResult.reason}`
      });
      throw new Error(operationResult.reason);
    }

    // Use new token-safe context builder for planning with degradation awareness
    let targetContextSize = 120000; // Default max tokens
    
    // Adjust context size based on degradation level
    if (operationResult.degradationLevel === 'light') {
      targetContextSize = 80000; // Reduce by 33%
    } else if (operationResult.degradationLevel === 'moderate') {
      targetContextSize = 60000; // Reduce by 50%
    } else if (operationResult.degradationLevel === 'severe') {
      targetContextSize = 40000; // Reduce by 67%
    }

    const contextResult = ContextBuilders.planning(
      'Analyze the current NeuronForge app state and generate a prioritized action plan for improvement',
      [] // No specific target files for general planning
    );

    // Log context building results
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Planner',
      message: `📝 Context built: ${contextResult.tokenCount} tokens, ${contextResult.stats.totalSources} sources (${contextResult.stats.filesIncluded} files, ${contextResult.stats.memoriesIncluded} memories, ${contextResult.stats.feedbacksIncluded} feedbacks)`
    });

    // Log any warnings
    if (contextResult.warnings.length > 0) {
      contextResult.warnings.forEach(warning => {
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Claude Planner',
          message: `⚠️ Context warning: ${warning}`
        });
      });
    }

    // Create token-safe planning prompt with smart context
    const prompt = `You are the lead AI architect for NeuronForge - a next-generation visual AI development platform.

${contextResult.context}

AVAILABLE ACTION TYPES:
- improve_file: Enhance existing files
- create_file: Create new files  
- delete_file: Remove unnecessary files
- ask_user: Ask clarifying questions
- debug_issue: Debug specific problems
- add_feature: Add new functionality
- generate_tests: Create comprehensive test files
- spawn_agent: Create specialized agents
- coordinate_agents: Manage agent collaboration
- analyze_dependencies: Review project dependencies

ADDITIONAL PLANNING GUIDELINES:
- PRIORITIZE user feedback - human guidance is most important
- Address specific issues raised in negative user feedback
- Continue successful patterns highlighted in positive user feedback
- Focus on files that have received poor quality scores or negative user ratings
- Consider missing functionality that would be valuable
- Identify potential bugs or issues to fix
- Suggest user experience enhancements
- Recommend architecture improvements
- Suggest test generation when test coverage is lacking

IMPORTANT: 
1. USER FEEDBACK takes highest priority - human guidance overrides AI preferences
2. Learn from past mistakes shown in self-critiques and feedback
3. If user feedback conflicts with self-critique, follow user guidance

If your plan includes file creation or modification, use the multi-file format provided in the context.

Return your response in this EXACT JSON format (no markdown, no extra text):

{
  "analysis": "Brief analysis of current state and opportunities",
  "confidence": 0.85,
  "actions": [
    {
      "type": "improve_file",
      "target": "/src/components/Button.tsx", 
      "reason": "The button lacks accessibility and uses hardcoded styles",
      "priority": "medium",
      "estimatedTime": "15 minutes",
      "dependencies": [],
      "confidence": 0.9,
      "impact": "medium",
      "coordination": {
        "parallel": true,
        "resources": ["/src/components/Button.tsx"],
        "constraints": ["requires_review"]
      }
    },
    {
      "type": "spawn_agent",
      "agentType": "ui_agent",
      "reason": "Need specialized UI expertise for complex components",
      "priority": "high", 
      "confidence": 0.8,
      "coordination": {
        "parallel": false,
        "resources": ["ui_generation", "design_system"]
      }
    }
  ],
  "orchestration": {
    "executionStrategy": "mixed",
    "estimatedDuration": 45,
    "resourceRequirements": ["file_system", "ui_agents"],
    "riskAssessment": "low",
    "dependencies": {"action_0": [], "action_1": ["action_0"]},
    "parallelGroups": [["action_0"], ["action_1"]]
  },
  "qualityMetrics": {
    "planCompleteness": 0.9,
    "actionCohesion": 0.85,
    "implementationFeasibility": 0.8
  }
}

IMPORTANT: Return ONLY the JSON, no other text.`;

    // Call Claude for planning
    const response = await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false, 
      includeProjectState: false,
      includeTaskMemory: false
    });

    // Check for multi-file responses first
    const { parseResult, applyResult } = parseAndApplyClaudeFiles(response, 'CLAUDE_PLANNER', {
      maxFiles: 10,
      maxFileSize: 20000,
      logParsing: true
    });

    if (parseResult.success && parseResult.files.length > 0) {
      useLogStore.getState().addLog({
        level: 'success',
        source: 'Claude Planner',
        message: `📄 Generated ${parseResult.files.length} files: ${parseResult.files.map(f => f.path).join(', ')}`
      });

      // Send file generation notification
      useMessageBus.getState().sendMessage({
        sender: 'CLAUDE_PLANNER',
        receiver: 'ALL',
        type: 'multi_file_update',
        content: previewParsedFiles(parseResult),
        priority: 'high',
        metadata: {
          tags: ['file-generation', 'multi-file', 'claude-planner'],
          fileCount: parseResult.files.length,
          totalSize: parseResult.totalSize,
          filePaths: parseResult.files.map(f => f.path)
        }
      });
    }

    // Parse Claude's planning response (JSON)
    let planData;
    try {
      planData = JSON.parse(response);
    } catch (jsonError) {
      // If response is not JSON, it might be multi-file format only
      if (parseResult.success && parseResult.files.length > 0) {
        // Create a plan based on the files generated
        planData = {
          analysis: `Generated ${parseResult.files.length} files based on project analysis`,
          confidence: 0.8,
          actions: parseResult.files.map((file, index) => ({
            type: 'improve_file',
            target: file.path,
            reason: `Generated/updated file with ${file.lineCount} lines`,
            priority: 'medium',
            estimatedTime: '5 minutes'
          }))
        };
      } else {
        throw new Error(`Failed to parse Claude response as JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      }
    }
    
    // Validate and enhance the plan with orchestration
    const plan: ClaudePlan = {
      analysis: planData.analysis || 'Analysis not provided',
      confidence: Math.min(Math.max(planData.confidence || 0.5, 0), 1),
      actions: (planData.actions || []).map((action: any, index: number) => ({
        type: action.type || 'ask_user',
        target: action.target,
        question: action.question,
        reason: action.reason || 'No reason provided',
        priority: action.priority || 'medium',
        estimatedTime: action.estimatedTime || 'Unknown',
        // Enhanced orchestration fields
        dependencies: action.dependencies || [],
        agentType: action.agentType,
        coordination: action.coordination || {
          parallel: false,
          resources: [],
          constraints: []
        },
        confidence: action.confidence || 0.7,
        impact: action.impact || 'medium'
      })),
      timestamp: Date.now(),
      // Enhanced orchestration metadata
      orchestration: planData.orchestration || {
        executionStrategy: 'sequential',
        estimatedDuration: 30,
        resourceRequirements: [],
        riskAssessment: 'medium',
        dependencies: {},
        parallelGroups: []
      },
      qualityMetrics: planData.qualityMetrics || {
        planCompleteness: 0.7,
        actionCohesion: 0.7,
        implementationFeasibility: 0.7
      }
    };

    // Enhanced orchestration analysis
    const orchestrationAnalysis = analyzeOrchestration(plan);
    
    // Log the enhanced planning activity with memory context
    const { getStats } = useMemorySummary();
    const memoryStats = getStats();
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Planner',
      message: `🚀 Generated orchestrated plan: ${plan.actions.length} actions, ${plan.orchestration.executionStrategy} strategy, ${plan.orchestration.estimatedDuration}min duration (confidence: ${Math.round(plan.confidence * 100)}%)`
    });

    // Enhanced planning logging with token safety metrics
    useLogStore.getState().addLog({
      level: 'success',
      source: 'Claude Planner',
      message: `✅ Token-safe planning context: ${contextResult.stats.totalSources} sources prioritized by relevance and user feedback`
    });

    // Store planning result in memory
    useMemoryStore.getState().addMemory(
      `Claude Planning Session: ${plan.analysis.substring(0, 100)}...`,
      'planning',
      {
        actionCount: plan.actions.length,
        confidence: plan.confidence,
        highPriorityActions: plan.actions.filter(a => a.priority === 'high').length,
        timestamp: plan.timestamp
      }
    );

    // Send planning notification to message bus with token-safe context stats
    useMessageBus.getState().sendMessage({
      sender: 'CLAUDE_PLANNER',
      receiver: 'ALL',
      type: 'context',
      content: `Generated new action plan: ${plan.actions.length} suggested actions with ${Math.round(plan.confidence * 100)}% confidence`,
      priority: 'high',
      metadata: {
        tags: ['planning', 'analysis', 'claude', 'token-safe', 'context-aware'],
        actionCount: plan.actions.length,
        confidence: plan.confidence,
        contextStats: contextResult.stats,
        tokenUsage: {
          used: contextResult.tokenCount,
          warnings: contextResult.warnings.length,
          includedSections: contextResult.includedSections.length,
          excludedSections: contextResult.excludedSections.length
        }
      }
    });

    // Send context snapshot to message bus for transparency
    useMessageBus.getState().sendMessage({
      sender: 'CLAUDE_PLANNER',
      receiver: 'ALL',
      type: 'context_snapshot',
      content: `Context built with ${contextResult.stats.totalSources} prioritized sources: ${contextResult.stats.feedbacksIncluded} user feedbacks, ${contextResult.stats.memoriesIncluded} memories, ${contextResult.stats.filesIncluded} files`,
      priority: 'medium',
      metadata: {
        tags: ['context', 'token-safe', 'planning'],
        contextStats: contextResult.stats,
        tokenCount: contextResult.tokenCount,
        warnings: contextResult.warnings
      }
    });

    // Track token usage in budget system
    const estimatedResponseTokens = response.length / 3.5; // Rough estimation
    tokenBudget.trackUsage(contextResult.tokenCount * 0.8, estimatedResponseTokens); // Context is mostly input

    // Log degradation status if applicable
    if (operationResult.degradationLevel !== 'none') {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Planner',
        message: `⚠️ Planning completed under ${operationResult.degradationLevel} degradation mode (context reduced to ${targetContextSize} tokens)`
      });
    }

    return plan;

  } catch (error) {
    console.error('Claude planning failed:', error);
    
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Claude Planner',
      message: `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    // Return fallback plan
    return {
      analysis: 'Planning failed due to error. Using fallback analysis.',
      confidence: 0.1,
      actions: [
        {
          type: 'ask_user',
          question: 'What would you like me to focus on improving?',
          reason: 'Planning system encountered an error and needs user guidance',
          priority: 'high',
          estimatedTime: '1 minute'
        }
      ],
      timestamp: Date.now()
    };
  }
}

function summarizeAppState(
  files: Record<string, FileRecord>,
  recentChanges: any[],
  recentMessages: AgentMessage[],
  recentLogs: any[],
  fileStats: any,
  memories: any[]
): string {
  const fileList = Object.values(files);
  
  // File summary
  const fileSummary = fileList
    .slice(0, 8) // Show top 8 files
    .map(f => `• ${f.path} (${f.size} chars, ${f.lineCount} lines, ${f.language}, by ${f.lastUpdatedBy})`)
    .join('\n');

  // Recent changes summary
  const changesSummary = recentChanges
    .slice(0, 5)
    .map(change => `• ${change.type.toUpperCase()}: ${change.file.path} by ${change.changedBy}`)
    .join('\n');

  // Error/warning logs
  const errorLogs = recentLogs
    .filter(log => log.level === 'error' || log.level === 'warn')
    .slice(-3)
    .map(log => `• ${log.level.toUpperCase()}: ${log.message}`)
    .join('\n');

  // Recent agent activity
  const agentActivity = recentMessages
    .slice(-5)
    .map(msg => `• ${msg.sender} → ${msg.receiver}: ${msg.type} - ${msg.content.substring(0, 50)}...`)
    .join('\n');

  // Memory insights
  const memoryInsights = memories
    .slice(-3)
    .map(mem => `• ${mem.type}: ${mem.content.substring(0, 60)}...`)
    .join('\n');

  return `
📊 PROJECT OVERVIEW:
Total Files: ${fileStats.totalFiles}
Total Lines: ${fileStats.totalLines}
Languages: ${Object.keys(fileStats.languageBreakdown).join(', ')}
Contributors: ${Object.keys(fileStats.agentContributions).join(', ')}

📁 CURRENT FILES:
${fileSummary || 'No files'}

🔄 RECENT CHANGES (last 5):
${changesSummary || 'No recent changes'}

🚨 ERRORS/WARNINGS:
${errorLogs || 'No recent errors'}

🤖 AGENT ACTIVITY:
${agentActivity || 'No recent activity'}

🧠 MEMORY INSIGHTS:
${memoryInsights || 'No recent memories'}

📈 FILE BREAKDOWN BY LANGUAGE:
${Object.entries(fileStats.languageBreakdown)
  .map(([lang, count]) => `• ${lang}: ${count} files`)
  .join('\n') || 'No language data'}

👥 CONTRIBUTIONS BY AGENT:
${Object.entries(fileStats.agentContributions)
  .map(([agent, count]) => `• ${agent}: ${count} files`)
  .join('\n') || 'No contribution data'}
`;
}

// Helper function to get language from file path (if needed)
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'tsx':
    case 'ts':
      return 'typescript';
    case 'jsx':
    case 'js':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

// Get prioritized actions (high priority first)
export function getPrioritizedActions(plan: ClaudePlan): ClaudeAction[] {
  const priority_order = { 'high': 3, 'medium': 2, 'low': 1 };
  
  return plan.actions.sort((a, b) => {
    const aPriority = priority_order[a.priority || 'medium'];
    const bPriority = priority_order[b.priority || 'medium'];
    return bPriority - aPriority;
  });
}

// Execute a specific action from the plan
export async function executeClaudeAction(action: ClaudeAction): Promise<boolean> {
  try {
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Planner',
      message: `Executing action: ${action.type} - ${action.reason}`
    });

    switch (action.type) {
      case 'ask_user':
        // For now, just log the question - UI will handle display
        useMessageBus.getState().sendMessage({
          sender: 'CLAUDE_PLANNER',
          receiver: 'USER',
          type: 'request',
          content: `Question: ${action.question}`,
          priority: 'high',
          metadata: {
            tags: ['user-question', 'planning'],
            actionType: action.type
          }
        });
        return true;

      case 'improve_file':
      case 'create_file':
      case 'delete_file':
        // These will be handled by the UI or other agents
        useMessageBus.getState().sendMessage({
          sender: 'CLAUDE_PLANNER',
          receiver: 'ALL',
          type: 'task',
          content: `Action ready: ${action.type} for ${action.target} - ${action.reason}`,
          priority: action.priority === 'high' ? 'high' : 'medium',
          metadata: {
            tags: ['file-action', 'planning'],
            actionType: action.type,
            target: action.target
          }
        });
        return true;

      case 'generate_tests':
        // Trigger test generation with Claude
        useMessageBus.getState().sendMessage({
          sender: 'CLAUDE_PLANNER',
          receiver: 'ALL',
          type: 'task',
          content: `Test generation recommended: ${action.reason}`,
          priority: action.priority === 'high' ? 'high' : 'medium',
          metadata: {
            tags: ['test-generation', 'planning', 'automation'],
            actionType: action.type,
            target: action.target || 'all',
            suggestion: 'Use the 🧪 Generate Tests button to create comprehensive test files'
          }
        });
        return true;

      default:
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Claude Planner',
          message: `Unknown action type: ${action.type}`
        });
        return false;
    }
  } catch (error) {
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Claude Planner',
      message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return false;
  }
}

// ===== ENHANCED ORCHESTRATION FUNCTIONS =====

/**
 * Analyzes an orchestrated plan for optimization opportunities
 */
export function analyzeOrchestration(plan: ClaudePlan): {
  parallelizableActions: number;
  criticalPath: ClaudeAction[];
  resourceConflicts: string[];
  optimizationSuggestions: string[];
} {
  const parallelizable = plan.actions.filter(action => 
    action.coordination?.parallel && !action.dependencies?.length
  ).length;

  const criticalPath = findCriticalPath(plan.actions);
  const resourceConflicts = findResourceConflicts(plan.actions);
  const optimizationSuggestions = generateOptimizationSuggestions(plan);

  return {
    parallelizableActions: parallelizable,
    criticalPath,
    resourceConflicts,
    optimizationSuggestions
  };
}

/**
 * Finds the critical path through action dependencies
 */
function findCriticalPath(actions: ClaudeAction[]): ClaudeAction[] {
  // Simple critical path analysis - find longest dependency chain
  const actionMap = new Map(actions.map((action, index) => [`action_${index}`, action]));
  let longestPath: ClaudeAction[] = [];
  
  actions.forEach((action, index) => {
    const path = traceDependencyPath(action, actionMap, `action_${index}`, new Set());
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  });
  
  return longestPath;
}

/**
 * Traces dependency path for an action
 */
function traceDependencyPath(
  action: ClaudeAction, 
  actionMap: Map<string, ClaudeAction>, 
  actionId: string,
  visited: Set<string>
): ClaudeAction[] {
  if (visited.has(actionId)) return []; // Circular dependency
  visited.add(actionId);
  
  const dependencies = action.dependencies || [];
  if (dependencies.length === 0) return [action];
  
  let longestSubPath: ClaudeAction[] = [];
  dependencies.forEach(depId => {
    const depAction = actionMap.get(depId);
    if (depAction) {
      const subPath = traceDependencyPath(depAction, actionMap, depId, new Set(visited));
      if (subPath.length > longestSubPath.length) {
        longestSubPath = subPath;
      }
    }
  });
  
  return [...longestSubPath, action];
}

/**
 * Finds resource conflicts between actions
 */
function findResourceConflicts(actions: ClaudeAction[]): string[] {
  const resourceUsage = new Map<string, ClaudeAction[]>();
  const conflicts: string[] = [];
  
  actions.forEach(action => {
    const resources = action.coordination?.resources || [];
    resources.forEach(resource => {
      if (!resourceUsage.has(resource)) {
        resourceUsage.set(resource, []);
      }
      resourceUsage.get(resource)!.push(action);
    });
  });
  
  resourceUsage.forEach((actionsUsingResource, resource) => {
    if (actionsUsingResource.length > 1) {
      const canRunInParallel = actionsUsingResource.every(action => 
        action.coordination?.parallel
      );
      if (!canRunInParallel) {
        conflicts.push(`Resource conflict: ${resource} needed by ${actionsUsingResource.length} actions`);
      }
    }
  });
  
  return conflicts;
}

/**
 * Generates optimization suggestions for the plan
 */
function generateOptimizationSuggestions(plan: ClaudePlan): string[] {
  const suggestions: string[] = [];
  
  // Check for parallelization opportunities
  const sequentialActions = plan.actions.filter(action => 
    !action.coordination?.parallel && !action.dependencies?.length
  );
  if (sequentialActions.length > 1) {
    suggestions.push(`${sequentialActions.length} actions could be parallelized`);
  }
  
  // Check for resource optimization
  const highResourceActions = plan.actions.filter(action => 
    (action.coordination?.resources?.length || 0) > 3
  );
  if (highResourceActions.length > 0) {
    suggestions.push(`${highResourceActions.length} actions have high resource requirements`);
  }
  
  // Check for risk assessment
  if (plan.orchestration.riskAssessment === 'high') {
    suggestions.push('Consider breaking down high-risk actions into smaller steps');
  }
  
  // Check plan quality metrics
  if (plan.qualityMetrics.implementationFeasibility < 0.7) {
    suggestions.push('Plan feasibility is low - consider alternative approaches');
  }
  
  return suggestions;
}

/**
 * Creates an orchestrated execution plan with enhanced workflow management
 */
export async function createOrchestrationPlan(prompt: string): Promise<ClaudePlan> {
  // Enhanced prompt with orchestration context
  const orchestrationPrompt = `
As an advanced AI orchestrator, analyze this request and create a sophisticated execution plan:

USER REQUEST: "${prompt}"

Consider these orchestration factors:
1. Agent coordination and resource allocation
2. Parallel execution opportunities  
3. Dependency management and sequencing
4. Risk assessment and error recovery
5. Quality metrics and success criteria

Create a plan that maximizes efficiency through intelligent coordination.
`;

  return await runClaudePlanner();
}

/**
 * Validates a plan for execution readiness
 */
export function validateOrchestrationPlan(plan: ClaudePlan): {
  isReady: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check for circular dependencies
  const hasCycles = detectCycles(plan.actions);
  if (hasCycles) {
    issues.push('Circular dependencies detected');
  }
  
  // Check resource availability
  const resourceConflicts = findResourceConflicts(plan.actions);
  issues.push(...resourceConflicts);
  
  // Check action confidence levels
  const lowConfidenceActions = plan.actions.filter(action => 
    (action.confidence || 0) < 0.5
  );
  if (lowConfidenceActions.length > 0) {
    recommendations.push(`${lowConfidenceActions.length} actions have low confidence - consider review`);
  }
  
  return {
    isReady: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Detects circular dependencies in action graph
 */
function detectCycles(actions: ClaudeAction[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(actionIndex: number): boolean {
    const actionId = `action_${actionIndex}`;
    if (recursionStack.has(actionId)) return true;
    if (visited.has(actionId)) return false;
    
    visited.add(actionId);
    recursionStack.add(actionId);
    
    const dependencies = actions[actionIndex].dependencies || [];
    for (const depId of dependencies) {
      const depIndex = parseInt(depId.replace('action_', ''));
      if (depIndex >= 0 && depIndex < actions.length && hasCycle(depIndex)) {
        return true;
      }
    }
    
    recursionStack.delete(actionId);
    return false;
  }
  
  for (let i = 0; i < actions.length; i++) {
    if (hasCycle(i)) return true;
  }
  
  return false;
}

/**
 * Generates critique context for Claude planning awareness
 */
function generateCritiqueContext(planningInsights: any, recentCritiques: any[]): string {
  if (recentCritiques.length === 0) {
    return `
🔍 Self-Critique Context:
No recent self-critiques available. Focus on writing high-quality, maintainable code.
    `.trim();
  }

  const avgQuality = recentCritiques.reduce((sum, c) => sum + c.quality, 0) / recentCritiques.length;
  const lowQualityFiles = recentCritiques.filter(c => c.quality < 6);
  
  return `
🔍 Self-Critique Context (${recentCritiques.length} recent reviews):
${planningInsights.critiqueSummary}

🚨 Problem Areas to Address:
${lowQualityFiles.length > 0 ? lowQualityFiles.map(c => 
  `• ${c.filePath}: ${c.quality}/10 - ${c.reasons.slice(0, 2).join(', ')}`
).join('\n') : '• No major quality issues detected'}

📋 Avoidance Patterns:
${planningInsights.avoidancePatterns.length > 0 
  ? planningInsights.avoidancePatterns.join('\n') 
  : '• No specific patterns to avoid identified'}

🎯 Improvement Goals:
${planningInsights.improvementGoals.length > 0 
  ? planningInsights.improvementGoals.map(goal => `• ${goal}`).join('\n')
  : '• Continue maintaining current quality standards'}

✅ Success Patterns to Continue:
${planningInsights.qualityMetrics.successPatterns.length > 0
  ? planningInsights.qualityMetrics.successPatterns.map(pattern => `• ${pattern}`).join('\n')
  : '• Maintain current coding practices'}
  `.trim();
}

/**
 * Generates user feedback context for Claude planning awareness
 */
function generateUserFeedbackContext(feedbackContext: string, recentNegative: any[], recentPositive: any[]): string {
  if (recentNegative.length === 0 && recentPositive.length === 0) {
    return `
💬 User Feedback Context:
No recent user feedback available. Focus on creating intuitive, high-quality outputs that prioritize user experience.
    `.trim();
  }

  return `
💬 User Feedback Context:
${feedbackContext}

🚨 HIGH PRIORITY - Recent User Issues (address immediately):
${recentNegative.length > 0 ? recentNegative.map(f => 
  `• ${f.metadata?.targetDisplay || f.target}: "${f.feedback}" (${f.rating}/5 ${f.category})`
).join('\n') : '• No critical user issues reported'}

✅ User-Approved Patterns (continue these):
${recentPositive.length > 0 ? recentPositive.map(f => 
  `• ${f.metadata?.targetDisplay || f.target}: "${f.feedback}" (${f.rating}/5 ${f.category})`
).join('\n') : '• No specific user praise yet'}

💡 User Feedback Guidelines:
- User satisfaction is the top priority
- Address negative feedback before adding new features
- Build on what users explicitly appreciate
- When in doubt, ask the user for clarification
  `.trim();
}