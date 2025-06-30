import { Node, Edge } from '@xyflow/react';

export type AgentNodeType = 'manager' | 'ui' | 'backend' | 'llm' | 'sandbox' | 'deployment';

export type AgentNodeStatus = 'idle' | 'working' | 'completed' | 'error' | 'waiting';

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  status: AgentNodeStatus;
  description?: string;
  progress?: number;
  lastUpdated?: string;
  error?: string;
  // Specific data for different node types
  config?: Record<string, any>;
}

export interface AgentNode extends Node {
  type: AgentNodeType;
  data: AgentNodeData;
}

export interface AgentConnection extends Edge {
  data?: {
    messageType?: string;
    lastMessage?: string;
    messageCount?: number;
  };
}

// Node theme configurations
export interface NodeTheme {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  icon: string;
}

export const NODE_THEMES: Record<AgentNodeType, NodeTheme> = {
  manager: {
    primary: 'bg-blue-500',
    secondary: 'bg-blue-50',
    accent: 'border-blue-200',
    text: 'text-blue-900',
    icon: '🧑‍💼'
  },
  ui: {
    primary: 'bg-green-500',
    secondary: 'bg-green-50',
    accent: 'border-green-200',
    text: 'text-green-900',
    icon: '🎨'
  },
  backend: {
    primary: 'bg-orange-500',
    secondary: 'bg-orange-50',
    accent: 'border-orange-200',
    text: 'text-orange-900',
    icon: '⚙️'
  },
  llm: {
    primary: 'bg-purple-500',
    secondary: 'bg-purple-50',
    accent: 'border-purple-200',
    text: 'text-purple-900',
    icon: '🤖'
  },
  sandbox: {
    primary: 'bg-indigo-500',
    secondary: 'bg-indigo-50',
    accent: 'border-indigo-200',
    text: 'text-indigo-900',
    icon: '🏃‍♂️'
  },
  deployment: {
    primary: 'bg-red-500',
    secondary: 'bg-red-50',
    accent: 'border-red-200',
    text: 'text-red-900',
    icon: '🚀'
  }
};

// Status configurations
export interface StatusConfig {
  color: string;
  bgColor: string;
  label: string;
}

export const STATUS_CONFIGS: Record<AgentNodeStatus, StatusConfig> = {
  idle: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Idle'
  },
  working: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Working'
  },
  completed: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Completed'
  },
  error: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Error'
  },
  waiting: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Waiting'
  }
};

// Helper functions
export const getNodeTheme = (nodeType: AgentNodeType): NodeTheme => {
  return NODE_THEMES[nodeType];
};

export const getStatusConfig = (status: AgentNodeStatus): StatusConfig => {
  return STATUS_CONFIGS[status];
};

// Sample node factory
export const createSampleNode = (
  id: string,
  type: AgentNodeType,
  position: { x: number; y: number },
  data: Partial<AgentNodeData> = {}
): AgentNode => {
  const theme = getNodeTheme(type);
  
  return {
    id,
    type,
    position,
    data: {
      label: `${theme.icon} ${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
      status: 'idle',
      description: `A ${type} agent ready to work`,
      progress: 0,
      lastUpdated: new Date().toISOString(),
      ...data
    }
  };
};