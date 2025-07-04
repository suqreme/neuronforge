import { useMemoryStore } from '../stores/memoryStore';
import { useTaskMemoryStore } from '../stores/taskMemoryStore';
import { useFileContext } from '../stores/fileContextStore';
import { useLogStore } from '../stores/logStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../stores/messageBus';
import { callClaudeWithContext } from '../utils/claudeApi';

export interface ProjectSummary {
  overview: string;
  filesCreated: Array<{
    path: string;
    type: string;
    purpose: string;
    status: 'complete' | 'partial' | 'needs_work';
  }>;
  capabilities: string[];
  missingFeatures: string[];
  bugs: string[];
  suggestions: string[];
  codeQuality: {
    score: number; // 1-10
    issues: string[];
    strengths: string[];
  };
  nextSteps: string[];
  confidence: number;
  timestamp: number;
}

export interface CriticAnalysis {
  type: 'progress_summary' | 'code_review' | 'architecture_review' | 'feature_gap_analysis';
  summary: ProjectSummary;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
}

export async function runSummarizerAgent(): Promise<CriticAnalysis> {
  const { addLog } = useLogStore.getState();
  const { sendMessage } = useMessageBus.getState();
  const { addTaskMemory } = useTaskMemoryStore.getState();

  try {
    addLog({
      level: 'info',
      source: 'Summarizer Agent',
      message: '🧠 Starting project analysis and summary generation...'
    });

    // Send start notification
    sendMessage(MessagePatterns.log(
      'SUMMARIZER_AGENT',
      '🧠 Analyzing project progress and generating summary...',
      ['analysis', 'project-summary']
    ));

    // Gather comprehensive project data
    const projectData = await gatherProjectData();
    
    // Generate AI-powered summary
    const summary = await generateProjectSummary(projectData);
    
    // Log the summary
    addLog({
      level: 'success',
      source: 'Critic Agent',
      message: formatSummaryForLog(summary)
    });

    // Add to task memory
    addTaskMemory({
      agent: 'CRITIC',
      taskId: `project-summary-${Date.now()}`,
      title: 'Project Progress Summary',
      content: `Generated comprehensive project analysis:\n\n${summary.overview}\n\nFiles: ${summary.filesCreated.length}\nCapabilities: ${summary.capabilities.length}\nIssues Found: ${summary.missingFeatures.length + summary.bugs.length}`,
      type: 'planning',
      status: 'completed',
      metadata: {
        importance: 'high',
        tags: ['project-summary', 'analysis', 'critic'],
        confidence: summary.confidence
      }
    });

    // Send completion notification
    sendMessage({
      sender: 'SUMMARIZER_AGENT',
      receiver: 'ALL',
      type: 'completion',
      content: `📊 Project Summary Complete: ${summary.filesCreated.length} files analyzed, ${summary.suggestions.length} suggestions generated`,
      priority: 'medium',
      metadata: {
        tags: ['project-summary', 'analysis-complete'],
        summaryScore: summary.codeQuality.score,
        fileCount: summary.filesCreated.length,
        suggestionCount: summary.suggestions.length
      }
    });

    return {
      type: 'progress_summary',
      summary,
      priority: summary.bugs.length > 0 || summary.codeQuality.score < 6 ? 'high' : 'medium',
      actionable: summary.nextSteps.length > 0 || summary.suggestions.length > 0
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    addLog({
      level: 'error',
      source: 'Summarizer Agent',
      message: `Failed to generate project summary: ${errorMsg}`
    });

    throw error;
  }
}

async function gatherProjectData(): Promise<{
  memoryEntries: any[];
  taskMemory: any[];
  files: any[];
  logs: any[];
  agents: string[];
}> {
  const { entries: memoryEntries } = useMemoryStore.getState();
  const { entries: taskMemory } = useTaskMemoryStore.getState();
  const { files } = useFileContext.getState();
  const { logs } = useLogStore.getState();

  // Get unique agents from task memory
  const agents = Array.from(new Set(taskMemory.map(entry => entry.agent)));

  // Convert files object to array if needed
  const filesArray = Array.isArray(files) ? files : Object.values(files);

  return {
    memoryEntries: memoryEntries.slice(-20), // Last 20 memory entries
    taskMemory: taskMemory.slice(-15), // Last 15 task memory entries
    files: filesArray.slice(0, 50), // Up to 50 files
    logs: logs.slice(-30), // Last 30 logs
    agents
  };
}

async function generateProjectSummary(data: any): Promise<ProjectSummary> {
  const filesContext = data.files.map(file => 
    `File: ${file.path} (${file.language})\nSize: ${file.content.length} chars\nPreview: ${file.content.substring(0, 200)}...`
  ).join('\n\n');

  const memoryContext = data.memoryEntries.map(entry => 
    `[${entry.type}] ${entry.content} (${new Date(entry.timestamp).toLocaleTimeString()})`
  ).join('\n');

  const taskContext = data.taskMemory.map(entry => 
    `[${entry.agent}] ${entry.title}: ${entry.content.substring(0, 100)}... (${entry.status})`
  ).join('\n');

  const recentLogs = data.logs.map(log => 
    `[${log.level}] ${log.source}: ${log.message}`
  ).slice(-10).join('\n');

  const prompt = `You are an expert project analyzer and technical critic. Analyze this development project and provide a comprehensive summary.

PROJECT FILES (${data.files.length} files):
${filesContext}

MEMORY ENTRIES (Recent Activity):
${memoryContext}

TASK MEMORY (Agent Work History):
${taskContext}

RECENT LOGS:
${recentLogs}

ACTIVE AGENTS: ${data.agents.join(', ')}

Provide a detailed JSON analysis with this exact structure:

{
  "overview": "Brief description of what has been built and current state",
  "filesCreated": [
    {
      "path": "file/path",
      "type": "component|utility|store|config|etc",
      "purpose": "what this file does",
      "status": "complete|partial|needs_work"
    }
  ],
  "capabilities": ["List of working features"],
  "missingFeatures": ["Features that should be implemented"],
  "bugs": ["Potential issues or bugs identified"],
  "suggestions": ["Specific improvement recommendations"],
  "codeQuality": {
    "score": 7.5,
    "issues": ["code quality problems"],
    "strengths": ["code quality strengths"]
  },
  "nextSteps": ["Prioritized action items"],
  "confidence": 0.85
}

Be thorough, specific, and actionable. Focus on practical insights that would help a developer continue this project.

Return ONLY the JSON, no additional text.`;

  const response = await callClaudeWithContext(prompt, [], {
    includeMemory: false,
    includeFiles: false,
    includeProjectState: false,
    includeTaskMemory: false
  });

  try {
    const summary = JSON.parse(response);
    
    // Validate and add metadata
    return {
      overview: summary.overview || 'No overview provided',
      filesCreated: summary.filesCreated || [],
      capabilities: summary.capabilities || [],
      missingFeatures: summary.missingFeatures || [],
      bugs: summary.bugs || [],
      suggestions: summary.suggestions || [],
      codeQuality: {
        score: Math.min(Math.max(summary.codeQuality?.score || 5, 1), 10),
        issues: summary.codeQuality?.issues || [],
        strengths: summary.codeQuality?.strengths || []
      },
      nextSteps: summary.nextSteps || [],
      confidence: Math.min(Math.max(summary.confidence || 0.5, 0), 1),
      timestamp: Date.now()
    };
  } catch (parseError) {
    console.error('Failed to parse summarizer response:', parseError);
    
    // Fallback summary
    return {
      overview: `Analysis of ${data.files.length} files with ${data.agents.length} active agents. Raw response: ${response.content.substring(0, 200)}...`,
      filesCreated: data.files.map(file => ({
        path: file.path,
        type: file.language || 'unknown',
        purpose: 'File in project',
        status: 'complete' as const
      })),
      capabilities: ['File editing', 'Multi-agent system'],
      missingFeatures: ['Unable to analyze due to parsing error'],
      bugs: ['Summarizer response parsing failed'],
      suggestions: ['Fix summarizer response format'],
      codeQuality: {
        score: 5,
        issues: ['Analysis parsing failed'],
        strengths: []
      },
      nextSteps: ['Debug summarizer agent'],
      confidence: 0.1,
      timestamp: Date.now()
    };
  }
}

function formatSummaryForLog(summary: ProjectSummary): string {
  return `📊 PROJECT SUMMARY REPORT

🎯 OVERVIEW: ${summary.overview}

📁 FILES (${summary.filesCreated.length}):
${summary.filesCreated.slice(0, 5).map(file => `• ${file.path} (${file.status})`).join('\n')}${summary.filesCreated.length > 5 ? `\n• ... and ${summary.filesCreated.length - 5} more` : ''}

✅ CAPABILITIES (${summary.capabilities.length}):
${summary.capabilities.slice(0, 3).map(cap => `• ${cap}`).join('\n')}${summary.capabilities.length > 3 ? `\n• ... and ${summary.capabilities.length - 3} more` : ''}

🔍 ISSUES FOUND (${summary.missingFeatures.length + summary.bugs.length}):
${[...summary.bugs.slice(0, 2), ...summary.missingFeatures.slice(0, 2)].map(issue => `• ${issue}`).join('\n')}

💡 TOP SUGGESTIONS:
${summary.suggestions.slice(0, 3).map(suggestion => `• ${suggestion}`).join('\n')}

📈 QUALITY SCORE: ${summary.codeQuality.score}/10 (Confidence: ${Math.round(summary.confidence * 100)}%)`;
}

// Specialized analyzers for different aspects
export async function analyzeCodeQuality(files: any[]): Promise<{score: number, issues: string[], strengths: string[]}> {
  // Implementation for focused code quality analysis
  return {
    score: 7.5,
    issues: ['Sample issue analysis'],
    strengths: ['Sample strength analysis']
  };
}

export async function analyzeArchitecture(files: any[], taskMemory: any[]): Promise<{
  patterns: string[];
  violations: string[];
  recommendations: string[];
}> {
  // Implementation for architecture analysis
  return {
    patterns: ['Component-based architecture'],
    violations: [],
    recommendations: ['Consider implementing...']
  };
}

export async function generateNextSteps(summary: ProjectSummary): Promise<string[]> {
  // Generate prioritized next steps based on analysis
  const steps = [];
  
  if (summary.bugs.length > 0) {
    steps.push(`Fix ${summary.bugs.length} identified bugs`);
  }
  
  if (summary.codeQuality.score < 7) {
    steps.push('Improve code quality and organization');
  }
  
  if (summary.missingFeatures.length > 0) {
    steps.push(`Implement ${Math.min(3, summary.missingFeatures.length)} key missing features`);
  }
  
  steps.push('Continue development based on analysis');
  
  return steps;
}