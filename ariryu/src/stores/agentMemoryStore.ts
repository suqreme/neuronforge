import { create } from 'zustand';

export interface AgentMemoryEntry {
  type: 'file_update' | 'task_assignment' | 'log_event' | 'file_generation' | 'completion' | 'error';
  file?: string;
  content?: string;
  message?: string;
  task?: string;
  timestamp: number;
  id: string;
  metadata?: Record<string, any>;
}

export interface AgentMemoryState {
  memory: Record<string, AgentMemoryEntry[]>;
  addMemory: (agentId: string, entry: Omit<AgentMemoryEntry, 'timestamp' | 'id'>) => void;
  getMemory: (agentId: string) => AgentMemoryEntry[];
  clearMemory: (agentId: string) => void;
  getAllAgents: () => string[];
  getRecentActivity: (agentId: string, limit?: number) => AgentMemoryEntry[];
  searchMemory: (agentId: string, query: string) => AgentMemoryEntry[];
}

export const useAgentMemoryStore = create<AgentMemoryState>((set, get) => ({
  memory: {},
  
  addMemory: (agentId: string, entry: Omit<AgentMemoryEntry, 'timestamp' | 'id'>) => {
    const current = get().memory[agentId] || [];
    const newEntry: AgentMemoryEntry = {
      ...entry,
      timestamp: Date.now(),
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    set(state => ({
      memory: {
        ...state.memory,
        [agentId]: [...current, newEntry]
      }
    }));
  },
  
  getMemory: (agentId: string) => {
    return get().memory[agentId] || [];
  },
  
  clearMemory: (agentId: string) => {
    set(state => ({
      memory: {
        ...state.memory,
        [agentId]: []
      }
    }));
  },
  
  getAllAgents: () => {
    return Object.keys(get().memory);
  },
  
  getRecentActivity: (agentId: string, limit: number = 10) => {
    const memory = get().memory[agentId] || [];
    return memory.slice(-limit);
  },
  
  searchMemory: (agentId: string, query: string) => {
    const memory = get().memory[agentId] || [];
    const lowercaseQuery = query.toLowerCase();
    
    return memory.filter(entry => 
      entry.type.toLowerCase().includes(lowercaseQuery) ||
      entry.file?.toLowerCase().includes(lowercaseQuery) ||
      entry.content?.toLowerCase().includes(lowercaseQuery) ||
      entry.message?.toLowerCase().includes(lowercaseQuery) ||
      entry.task?.toLowerCase().includes(lowercaseQuery)
    );
  }
}));