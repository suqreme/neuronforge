import { useAgentMemoryStore } from '../stores/agentMemoryStore';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useTaskMemoryStore } from '../stores/taskMemoryStore';
import { trackTokenUsage, checkTokenLimits } from './tokenUsageMonitor';
import { ReviewableFile, ReviewResult, createReviewPrompt, validateReviewResponse } from './selfReviewHelper';
// Note: Direct Claude API integration - no longer depends on llmClient

export type LLMProvider = 'claude' | 'openai';

export interface ClaudeChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  id: string;
}

export interface ClaudeChatOptions {
  includeMemory?: boolean;
  includeFiles?: boolean;
  includeProjectState?: boolean;
  includeTaskMemory?: boolean;
  maxMemoryEntries?: number;
  maxFileContext?: number;
  maxTaskMemory?: number;
  enableActions?: boolean;
}

export interface ClaudeAction {
  action: 'update_file' | 'create_file' | 'delete_file';
  path: string;
  content?: string;
  reason?: string;
}

export interface ClaudeResponse {
  type: 'message' | 'action';
  content?: string;
  action?: ClaudeAction;
}

export async function callClaudeWithContext(
  prompt: string, 
  conversationHistory: ClaudeChatMessage[] = [],
  options: ClaudeChatOptions = {}
): Promise<string> {
  const {
    includeMemory = true,
    includeFiles = true,
    includeProjectState = true,
    includeTaskMemory = true,
    maxMemoryEntries = 10,
    maxFileContext = 5,
    maxTaskMemory = 5,
    enableActions = false
  } = options;

  try {
    // 🛡️ SAFETY CHECK: Prevent runaway token usage
    const tokenCheck = checkTokenLimits();
    if (!tokenCheck.allowed) {
      throw new Error(`🚨 Token Safety: ${tokenCheck.reason}`);
    }

    // Build context from memory, files, and project state
    const contextParts = [];

    if (includeProjectState) {
      const { project } = useProjectStore.getState();
      if (project) {
        contextParts.push(`PROJECT STATUS:
Name: ${project.name}
Status: ${project.status}
Agents: ${project.agents.map(a => `${a.name} (${a.status})`).join(', ')}
Description: ${project.description || 'No description provided'}`);
      }
    }

    if (includeFiles) {
      const { openTabs } = useEditorStore.getState();
      const recentFiles = openTabs.slice(0, maxFileContext);
      
      if (recentFiles.length > 0) {
        contextParts.push(`CURRENT FILES (${recentFiles.length}):
${recentFiles.map(file => 
  `• ${file.path} (${file.language}) - ${file.content.split('\n').length} lines
  Content preview: ${file.content.substring(0, 200)}${file.content.length > 200 ? '...' : ''}`
).join('\n')}`);
      }
    }

    if (includeMemory) {
      const { getAllAgents, getRecentActivity } = useAgentMemoryStore.getState();
      const agents = getAllAgents();
      
      if (agents.length > 0) {
        const recentActivities = agents.map(agentId => {
          const activities = getRecentActivity(agentId, maxMemoryEntries);
          return {
            agent: agentId,
            activities: activities.slice(-3) // Last 3 activities per agent
          };
        }).filter(a => a.activities.length > 0);

        if (recentActivities.length > 0) {
          contextParts.push(`RECENT AGENT ACTIVITIES:
${recentActivities.map(({ agent, activities }) => 
  `${agent.toUpperCase()}:
${activities.map(activity => 
  `  • ${activity.type}: ${activity.message || activity.file || 'No message'} (${new Date(activity.timestamp).toLocaleTimeString()})`
).join('\n')}`
).join('\n\n')}`);
        }
      }
    }

    if (includeTaskMemory) {
      const { getRecentMemory, getCurrentSession, getSessionContext } = useTaskMemoryStore.getState();
      
      // Include current session context if available
      const currentSession = getCurrentSession();
      if (currentSession) {
        const sessionContext = getSessionContext();
        if (sessionContext) {
          contextParts.push(`CURRENT SESSION (${currentSession.agent}):
Objective: ${currentSession.objective}
Started: ${new Date(currentSession.startTime).toLocaleString()}
Tasks Completed: ${currentSession.taskCount}

${sessionContext}`);
        }
      }

      // Include recent task memory for Claude specifically
      const recentTasks = getRecentMemory('CLAUDE', maxTaskMemory);
      if (recentTasks.length > 0) {
        contextParts.push(`MY RECENT WORK HISTORY:
${recentTasks.map(task => 
  `### ${task.title} (${task.type})
${task.content}
Status: ${task.status} | ${new Date(task.createdAt).toLocaleString()}`
).join('\n\n')}`);
      }

      // Include recent critic feedback
      const criticTasks = getRecentMemory('CRITIC', 3);
      if (criticTasks.length > 0) {
        contextParts.push(`RECENT CRITIC FEEDBACK:
${criticTasks.map(task => 
  `### ${task.title}
${task.content}
Confidence: ${task.metadata?.confidence ? Math.round(task.metadata.confidence * 100) : 'N/A'}% | ${new Date(task.createdAt).toLocaleString()}`
).join('\n\n')}`);
      }
    }

    // Build conversation context
    const conversationContext = conversationHistory.length > 0 
      ? `CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}`
      : '';

    // Construct system prompt with context
    const systemPrompt = `You are Claude, the lead AI architect for NeuronForge, a visual AI development platform where AI agents collaborate to build web applications.

${contextParts.length > 0 ? `CURRENT CONTEXT:
${contextParts.join('\n\n')}` : ''}

${conversationContext}

INSTRUCTIONS:
- Use the provided context to give intelligent, contextual responses
- Reference specific files, agents, or activities when relevant
- Provide actionable advice for development tasks
- Keep responses concise but informative

${enableActions ? `
FILE ACTIONS ENABLED:
When asked to create, update, or modify files, respond with a JSON object in this exact format:
{
  "action": "create_file" | "update_file" | "delete_file",
  "path": "relative/path/to/file.ext",
  "content": "full file content here",
  "reason": "brief explanation of what you changed"
}

For file updates, always provide the COMPLETE file content, not just changes.
For file creation, ensure the path and content are appropriate for the project structure.
Only use actions when explicitly asked to modify files. For explanations or advice, use regular responses.
` : '- If asked to perform file actions, explain what would need to be done but note that file actions are not currently enabled'}`;

    // Call Claude API directly via proxy
    const CLAUDE_PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || "http://localhost:3001/claude";
    
    const response = await fetch(CLAUDE_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude Proxy error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // 📊 TRACK TOKEN USAGE
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const usage = trackTokenUsage(inputTokens, outputTokens);
    
    console.log('🔍 Token Usage:', {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
      dailyTotal: usage.totalTokens,
      requestCount: usage.requestCount
    });
    
    return data.content[0]?.text || "";

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw new Error(`Failed to get Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced function that supports both messages and actions
export async function callClaudeWithActions(
  prompt: string, 
  conversationHistory: ClaudeChatMessage[] = [],
  options: ClaudeChatOptions = {}
): Promise<ClaudeResponse> {
  const response = await callClaudeWithContext(prompt, conversationHistory, {
    ...options,
    enableActions: true
  });

  // Try to parse as JSON action
  try {
    const trimmed = response.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.action && parsed.path) {
        return {
          type: 'action',
          action: parsed as ClaudeAction
        };
      }
    }
  } catch (error) {
    // Not valid JSON, treat as regular message
  }

  // Return as regular message
  return {
    type: 'message',
    content: response
  };
}

// Helper function for simple Claude calls without context
export async function callClaudeSimple(prompt: string): Promise<string> {
  return callClaudeWithContext(prompt, [], {
    includeMemory: false,
    includeFiles: false,
    includeProjectState: false
  });
}

// Helper function to format memory for context
export function formatMemoryForContext(agentId: string, maxEntries: number = 5): string {
  const { getRecentActivity } = useAgentMemoryStore.getState();
  const activities = getRecentActivity(agentId, maxEntries);
  
  if (activities.length === 0) {
    return `No recent activities for ${agentId}`;
  }

  return activities.map(activity => {
    const time = new Date(activity.timestamp).toLocaleTimeString();
    return `[${time}] ${activity.type}: ${activity.message || activity.file || 'No details'}`;
  }).join('\n');
}

// Helper function to format files for context
export function formatFilesForContext(maxFiles: number = 5): string {
  const { openTabs } = useEditorStore.getState();
  const files = openTabs.slice(0, maxFiles);
  
  if (files.length === 0) {
    return 'No files currently open';
  }

  return files.map(file => {
    const lines = file.content.split('\n').length;
    const preview = file.content.substring(0, 150);
    return `${file.path} (${file.language}, ${lines} lines): ${preview}${file.content.length > 150 ? '...' : ''}`;
  }).join('\n\n');
}

// ===== UNIFIED AI CLIENT INTERFACE =====
// This replaces all previous AI client implementations
// Provides backward compatibility while centralizing AI operations

export interface UnifiedAIClient {
  // Core AI functions
  callAI: typeof callClaudeWithContext;
  callSimple: typeof callClaudeSimple;
  callWithActions: typeof callClaudeWithActions;
  
  // Backward compatibility aliases
  callClaude: typeof callClaudeSimple;
  callLLM: (options: { provider: string; prompt: string; system?: string; temperature?: number; maxTokens?: number }) => Promise<{ content: string }>;
}

// Unified AI client instance
export const AI: UnifiedAIClient = {
  // Primary functions
  callAI: callClaudeWithContext,
  callSimple: callClaudeSimple,
  callWithActions: callClaudeWithActions,
  
  // Backward compatibility
  callClaude: callClaudeSimple,
  callLLM: async (options) => {
    const response = await callClaudeWithContext(options.prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });
    return { content: response };
  }
};

// Types are already exported above, no need to re-export

// Legacy exports for backward compatibility
export const callClaude = callClaudeSimple;
export const callLLM = AI.callLLM;

/**
 * Asks Claude to review project files and suggest fixes
 */
export async function askClaudeToReviewAndFix(files: ReviewableFile[]): Promise<ReviewResult[]> {
  try {
    // Check token limits before making the call
    checkTokenLimits();
    
    // Create the review prompt
    const prompt = createReviewPrompt(files);
    
    console.log('🔍 Starting Claude self-review for', files.length, 'files...');
    
    // Call Claude with the review prompt
    const response = await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });
    
    // Validate and parse the response
    const reviewResults = validateReviewResponse(response);
    
    if (!reviewResults) {
      throw new Error('Claude returned invalid review response format');
    }
    
    console.log('✅ Claude self-review completed:', reviewResults.length, 'files need fixing');
    
    return reviewResults;
    
  } catch (error) {
    console.error('❌ Claude self-review failed:', error);
    throw new Error(`Self-review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Asks Claude to review and improve a single file
 */
export async function askClaudeToReviewSingleFile(
  filePath: string,
  content: string,
  language: string
): Promise<ReviewResult | null> {
  try {
    const file: ReviewableFile = {
      path: filePath,
      content,
      language,
      size: content.length,
      lineCount: content.split('\n').length,
      lastUpdatedBy: 'user',
      priority: 'high'
    };
    
    const results = await askClaudeToReviewAndFix([file]);
    return results.length > 0 ? results[0] : null;
    
  } catch (error) {
    console.error('❌ Single file review failed:', error);
    return null;
  }
}

/**
 * Asks Claude to analyze code quality issues without fixing
 */
export async function askClaudeToAnalyzeQuality(files: ReviewableFile[]): Promise<string> {
  try {
    const prompt = `You are a senior code reviewer analyzing the NeuronForge AI development platform.

Review these files and provide a quality analysis report:

1. Overall code quality assessment (1-10 score)
2. Top 5 issues found across all files
3. Recommendations for improvement
4. Estimated time to fix major issues

FILES:
${files.map(file => `
Path: ${file.path} (${file.language})
Size: ${file.lineCount} lines
Priority: ${file.priority}

Content preview:
${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}
`).join('\n')}

Provide a concise analysis report.`;

    return await callClaudeWithContext(prompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });
    
  } catch (error) {
    console.error('❌ Quality analysis failed:', error);
    throw new Error(`Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}