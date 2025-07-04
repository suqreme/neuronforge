export interface Agent {
  id: string;
  name: string;
  type: 'manager' | 'ui' | 'backend' | 'llm' | 'deploy' | 'memory' | 'log';
  status: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
}

export interface AgentDebugInfo {
  id: string;
  name: string;
  type: string;
  task?: string;
  memory: Record<string, any>;
  logs: string[];
  thoughts: string;
  status: string;
  progress: number;
  updatedAt: number;
}

export interface LogMessage {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'agent';
  source: string;
  message: string;
  agentId?: string;
}

export interface EditorFile {
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
}

export interface EditorTab {
  id: string;
  filename: string;
  content: string;
  language: string;
  isDirty: boolean;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'idle' | 'building' | 'running' | 'error';
  agents: Agent[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentMessage {
  from: string;
  to: string | 'all';
  type: 'file_update' | 'log' | 'status_update';
  payload: any;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: number;
}

// Phase 30: Agent Feedback System Types
export interface AgentFeedback {
  id: string;
  agent: string; // The agent who created the output being reviewed
  reviewer: string; // The agent providing feedback (usually Claude)
  targetFile: string;
  feedback: string;
  timestamp: number;
  qualityScore: number; // 0 to 1 (0 = poor, 1 = excellent)
  category: 'code_quality' | 'performance' | 'style' | 'best_practice' | 'security' | 'maintainability';
  severity: 'low' | 'medium' | 'high';
  suggestions?: string[]; // Specific improvement suggestions
  isResolved?: boolean; // Whether the feedback has been addressed
  metadata?: {
    fileSize: number;
    language: string;
    lineCount: number;
    complexity?: number;
    tags?: string[];
  };
}

export interface FeedbackSummary {
  agent: string;
  totalFeedbacks: number;
  averageQualityScore: number;
  categoryBreakdown: Record<string, number>;
  recentTrends: {
    improving: boolean;
    scoreChange: number; // Change over last 10 feedbacks
  };
  topIssues: string[]; // Most common feedback categories
}