import { create } from 'zustand';
import { Agent, AgentMessage, AgentDebugInfo } from '../types';

interface AgentState {
  agents: Agent[];
  agentDebugInfo: Record<string, AgentDebugInfo>;
  messages: AgentMessage[];
  isProcessing: boolean;
}

interface AgentActions {
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  removeAgent: (agentId: string) => void;
  sendMessage: (message: Omit<AgentMessage, 'timestamp'>) => void;
  clearMessages: () => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  resetAllAgents: () => void;
  // Debug methods
  updateAgentDebug: (id: string, partial: Partial<AgentDebugInfo>) => void;
  appendLog: (id: string, entry: string) => void;
  setThoughts: (id: string, thoughts: string) => void;
  updateMemory: (id: string, key: string, value: any) => void;
  getAgentDebugInfo: (id: string) => AgentDebugInfo | undefined;
}

// Mock agents - these will be managed by the project store primarily
const mockAgents: Agent[] = [
  {
    id: 'manager-agent',
    name: 'Manager Agent',
    type: 'manager',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'ui-agent',
    name: 'UI Agent',
    type: 'ui',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'backend-agent',
    name: 'Backend Agent',
    type: 'backend',
    status: 'idle',
    progress: 0,
  },
];

// Initial debug info for mock agents
const initialDebugInfo: Record<string, AgentDebugInfo> = {
  'manager-agent': {
    id: 'manager-agent',
    name: 'Manager Agent',
    type: 'manager',
    task: 'Project coordination and task management',
    memory: { 
      currentProject: null,
      taskQueue: [],
      completedTasks: []
    },
    logs: ['Agent initialized', 'Ready for task assignment'],
    thoughts: '🤔 Waiting for project prompt to begin analysis...',
    status: 'idle',
    progress: 0,
    updatedAt: Date.now(),
  },
  'ui-agent': {
    id: 'ui-agent',
    name: 'UI Agent',
    type: 'ui',
    task: 'React component generation and UI development',
    memory: { 
      componentLibrary: 'React + Tailwind',
      designPatterns: ['hooks', 'functional components'],
      aiModel: 'Claude 3.5 Sonnet',
      lastComponent: null
    },
    logs: ['Agent initialized', 'Ready for UI generation tasks'],
    thoughts: '🎨 Ready to create beautiful React components...',
    status: 'idle',
    progress: 0,
    updatedAt: Date.now(),
  },
  'backend-agent': {
    id: 'backend-agent',
    name: 'Backend Agent',
    type: 'backend',
    task: 'API development and server-side logic',
    memory: { 
      framework: 'Express.js',
      aiModel: 'Claude 3.5 Sonnet',
      database: null,
      endpoints: []
    },
    logs: ['Agent initialized', 'Ready for backend development'],
    thoughts: '⚙️ Waiting for backend requirements specification...',
    status: 'idle',
    progress: 0,
    updatedAt: Date.now(),
  },
};

export const useAgentStore = create<AgentState & AgentActions>((set, get) => ({
  agents: mockAgents,
  agentDebugInfo: initialDebugInfo,
  messages: [],
  isProcessing: false,

  addAgent: (agent) => {
    set((state) => ({
      agents: [...state.agents, agent],
    }));
  },

  updateAgent: (agentId, updates) => {
    set((state) => ({
      agents: state.agents.map(agent =>
        agent.id === agentId 
          ? { ...agent, ...updates }
          : agent
      ),
    }));
  },

  removeAgent: (agentId) => {
    set((state) => ({
      agents: state.agents.filter(agent => agent.id !== agentId),
    }));
  },

  sendMessage: (messageData) => {
    const message: AgentMessage = {
      ...messageData,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, message],
    }));

    // Auto-trace agent communications
    const { appendLog } = get();
    
    // Log outgoing message for sender
    appendLog(message.from, `📤 Sent → ${message.to}: ${message.type}`);
    
    // Log incoming message for specific recipient (not for broadcast messages)
    const currentState = get();
    if (message.to !== "all" && currentState.agentDebugInfo[message.to]) {
      appendLog(message.to, `📥 Received ← ${message.from}: ${message.type}`);
    }

    // For broadcast messages, log to all agents except sender
    if (message.to === "all") {
      Object.keys(currentState.agentDebugInfo).forEach(agentId => {
        if (agentId !== message.from) {
          appendLog(agentId, `📢 Broadcast ← ${message.from}: ${message.type}`);
        }
      });
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  startProcessing: () => {
    set({ isProcessing: true });
  },

  stopProcessing: () => {
    set({ isProcessing: false });
  },

  resetAllAgents: () => {
    set((state) => ({
      agents: state.agents.map(agent => ({
        ...agent,
        status: 'idle' as const,
        progress: 0,
      })),
      messages: [],
      isProcessing: false,
    }));
  },

  // Debug methods implementation
  updateAgentDebug: (id, partial) => {
    set((state) => ({
      agentDebugInfo: {
        ...state.agentDebugInfo,
        [id]: {
          ...state.agentDebugInfo[id],
          ...partial,
          updatedAt: Date.now()
        }
      }
    }));
  },

  appendLog: (id, entry) => {
    set((state) => {
      const existing = state.agentDebugInfo[id];
      if (!existing) return state;
      
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${entry}`;
      
      return {
        agentDebugInfo: {
          ...state.agentDebugInfo,
          [id]: {
            ...existing,
            logs: [...existing.logs, logEntry],
            updatedAt: Date.now()
          }
        }
      };
    });
  },

  setThoughts: (id, thoughts) => {
    set((state) => ({
      agentDebugInfo: {
        ...state.agentDebugInfo,
        [id]: {
          ...state.agentDebugInfo[id],
          thoughts,
          updatedAt: Date.now()
        }
      }
    }));
  },

  updateMemory: (id, key, value) => {
    set((state) => {
      const existing = state.agentDebugInfo[id];
      if (!existing) return state;
      
      return {
        agentDebugInfo: {
          ...state.agentDebugInfo,
          [id]: {
            ...existing,
            memory: {
              ...existing.memory,
              [key]: value
            },
            updatedAt: Date.now()
          }
        }
      };
    });
  },

  getAgentDebugInfo: (id) => {
    return get().agentDebugInfo[id];
  },
}));