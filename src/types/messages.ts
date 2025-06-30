export interface TaskMessage {
  id: string;
  type: 'task_assignment' | 'task_update' | 'task_complete' | 'request_help' | 'error';
  from: string;
  to: string;
  timestamp: number;
  payload: TaskPayload;
}

export interface TaskPayload {
  taskId?: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  data?: Record<string, any>;
  error?: string;
}

export interface PromptAnalysis {
  appType: string;
  strategy: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTime: string;
  requiredAgents: string[];
  tasks: TaskBreakdown[];
}

export interface TaskBreakdown {
  id: string;
  type: 'ui' | 'backend' | 'llm' | 'sandbox' | 'deployment';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  estimatedDuration: string;
  data: Record<string, any>;
}

export interface AgentCommunication {
  messageId: string;
  conversationId: string;
  from: string;
  to: string;
  messageType: 'coordination' | 'data_share' | 'status_update' | 'error_report';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

// Message templates for common scenarios
export const createTaskAssignment = (
  from: string,
  to: string,
  description: string,
  data: Record<string, any> = {}
): TaskMessage => ({
  id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'task_assignment',
  from,
  to,
  timestamp: Date.now(),
  payload: {
    description,
    priority: 'medium',
    status: 'pending',
    progress: 0,
    data
  }
});

export const createStatusUpdate = (
  from: string,
  to: string,
  taskId: string,
  progress: number,
  status: TaskPayload['status']
): TaskMessage => ({
  id: `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'task_update',
  from,
  to,
  timestamp: Date.now(),
  payload: {
    taskId,
    description: `Task progress update: ${progress}%`,
    priority: 'low',
    status,
    progress
  }
});

export const createErrorReport = (
  from: string,
  to: string,
  error: string,
  taskId?: string
): TaskMessage => ({
  id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'error',
  from,
  to,
  timestamp: Date.now(),
  payload: {
    taskId,
    description: 'Error occurred during task execution',
    priority: 'high',
    status: 'error',
    error
  }
});

// Helper functions
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

export const getMessageTypeColor = (type: TaskMessage['type']): string => {
  const colors = {
    'task_assignment': 'text-blue-600',
    'task_update': 'text-green-600', 
    'task_complete': 'text-emerald-600',
    'request_help': 'text-yellow-600',
    'error': 'text-red-600'
  };
  return colors[type] || 'text-gray-600';
};

export const getMessageTypeIcon = (type: TaskMessage['type']): string => {
  const icons = {
    'task_assignment': '📋',
    'task_update': '🔄',
    'task_complete': '✅',
    'request_help': '🆘',
    'error': '❌'
  };
  return icons[type] || '📨';
};