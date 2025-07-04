import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TaskMemoryEntry {
  id: string;
  agent: string;
  taskId: string;
  title: string;
  content: string;
  createdAt: number;
  type: 'task_start' | 'task_progress' | 'task_complete' | 'file_generation' | 'critique' | 'error' | 'planning';
  status: 'active' | 'completed' | 'failed' | 'paused';
  metadata?: {
    filePath?: string;
    actionType?: string;
    importance?: 'low' | 'medium' | 'high';
    tags?: string[];
    parentTaskId?: string;
    estimatedTime?: string;
    actualTime?: number;
    dependencies?: string[];
    relatedFiles?: string[];
    critiqueScore?: number;
    confidence?: number;
  };
}

export interface TaskSession {
  id: string;
  startTime: number;
  endTime?: number;
  agent: string;
  objective: string;
  status: 'active' | 'completed' | 'paused';
  taskCount: number;
  memoryEntries: string[]; // IDs of related memory entries
}

export interface TaskMemoryState {
  entries: TaskMemoryEntry[];
  sessions: TaskSession[];
  maxEntries: number;
  maxSessions: number;
  currentSessionId?: string;
  
  // Task Management
  addTaskMemory: (entry: Omit<TaskMemoryEntry, 'id' | 'createdAt'>) => string;
  updateTaskMemory: (id: string, updates: Partial<TaskMemoryEntry>) => void;
  removeTaskMemory: (id: string) => void;
  clearTaskMemory: () => void;
  
  // Session Management
  startSession: (agent: string, objective: string) => string;
  endSession: (sessionId?: string) => void;
  pauseSession: (sessionId?: string) => void;
  resumeSession: (sessionId: string) => void;
  getCurrentSession: () => TaskSession | undefined;
  
  // Query Functions
  getAgentMemory: (agent: string, limit?: number) => TaskMemoryEntry[];
  getTaskMemory: (taskId: string) => TaskMemoryEntry[];
  getSessionMemory: (sessionId: string) => TaskMemoryEntry[];
  getRecentMemory: (agent?: string, limit?: number) => TaskMemoryEntry[];
  getMemoryByType: (type: TaskMemoryEntry['type'], agent?: string) => TaskMemoryEntry[];
  searchMemory: (query: string, agent?: string) => TaskMemoryEntry[];
  
  // Context Building
  getTaskContext: (agent: string, taskId?: string) => string;
  getSessionContext: (sessionId?: string) => string;
  getAgentWorkHistory: (agent: string, days?: number) => TaskMemoryEntry[];
  
  // Analytics
  getTaskStats: (agent?: string) => {
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    failedTasks: number;
    averageTaskTime: number;
    mostRecentActivity: number;
  };
  
  // Settings
  setMaxEntries: (max: number) => void;
  setMaxSessions: (max: number) => void;
}

export const useTaskMemoryStore = create<TaskMemoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      sessions: [],
      maxEntries: 500,
      maxSessions: 50,
      currentSessionId: undefined,

      // Task Management
      addTaskMemory: (entry) => {
        const newEntry: TaskMemoryEntry = {
          ...entry,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };

        set((state) => {
          let newEntries = [...state.entries, newEntry];
          
          // Trim entries if exceeding max
          if (newEntries.length > state.maxEntries) {
            newEntries = newEntries.slice(-state.maxEntries);
          }
          
          // Update current session
          let newSessions = state.sessions;
          if (state.currentSessionId) {
            newSessions = state.sessions.map(session => 
              session.id === state.currentSessionId 
                ? { 
                    ...session, 
                    taskCount: session.taskCount + 1,
                    memoryEntries: [...session.memoryEntries, newEntry.id]
                  }
                : session
            );
          }
          
          return { 
            entries: newEntries,
            sessions: newSessions
          };
        });

        return newEntry.id;
      },

      updateTaskMemory: (id, updates) => {
        set((state) => ({
          entries: state.entries.map(entry => 
            entry.id === id ? { ...entry, ...updates } : entry
          )
        }));
      },

      removeTaskMemory: (id) => {
        set((state) => ({
          entries: state.entries.filter(entry => entry.id !== id)
        }));
      },

      clearTaskMemory: () => {
        set({ entries: [], sessions: [], currentSessionId: undefined });
      },

      // Session Management
      startSession: (agent, objective) => {
        const newSession: TaskSession = {
          id: crypto.randomUUID(),
          startTime: Date.now(),
          agent,
          objective,
          status: 'active',
          taskCount: 0,
          memoryEntries: []
        };

        set((state) => {
          let newSessions = [...state.sessions, newSession];
          
          // Trim sessions if exceeding max
          if (newSessions.length > state.maxSessions) {
            newSessions = newSessions.slice(-state.maxSessions);
          }
          
          return { 
            sessions: newSessions,
            currentSessionId: newSession.id 
          };
        });

        return newSession.id;
      },

      endSession: (sessionId) => {
        const targetId = sessionId || get().currentSessionId;
        if (!targetId) return;

        set((state) => ({
          sessions: state.sessions.map(session => 
            session.id === targetId 
              ? { ...session, status: 'completed' as const, endTime: Date.now() }
              : session
          ),
          currentSessionId: targetId === state.currentSessionId ? undefined : state.currentSessionId
        }));
      },

      pauseSession: (sessionId) => {
        const targetId = sessionId || get().currentSessionId;
        if (!targetId) return;

        set((state) => ({
          sessions: state.sessions.map(session => 
            session.id === targetId 
              ? { ...session, status: 'paused' as const }
              : session
          )
        }));
      },

      resumeSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map(session => 
            session.id === sessionId 
              ? { ...session, status: 'active' as const }
              : session
          ),
          currentSessionId: sessionId
        }));
      },

      getCurrentSession: () => {
        const state = get();
        return state.sessions.find(session => session.id === state.currentSessionId);
      },

      // Query Functions
      getAgentMemory: (agent, limit = 20) => {
        const entries = get().entries
          .filter(entry => entry.agent === agent)
          .sort((a, b) => b.createdAt - a.createdAt);
        return limit > 0 ? entries.slice(0, limit) : entries;
      },

      getTaskMemory: (taskId) => {
        return get().entries
          .filter(entry => entry.taskId === taskId)
          .sort((a, b) => a.createdAt - b.createdAt);
      },

      getSessionMemory: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return [];
        
        return get().entries
          .filter(entry => session.memoryEntries.includes(entry.id))
          .sort((a, b) => a.createdAt - b.createdAt);
      },

      getRecentMemory: (agent, limit = 10) => {
        let entries = get().entries;
        
        if (agent) {
          entries = entries.filter(entry => entry.agent === agent);
        }
        
        return entries
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
      },

      getMemoryByType: (type, agent) => {
        let entries = get().entries.filter(entry => entry.type === type);
        
        if (agent) {
          entries = entries.filter(entry => entry.agent === agent);
        }
        
        return entries.sort((a, b) => b.createdAt - a.createdAt);
      },

      searchMemory: (query, agent) => {
        const lowercaseQuery = query.toLowerCase();
        let entries = get().entries;
        
        if (agent) {
          entries = entries.filter(entry => entry.agent === agent);
        }
        
        return entries.filter(entry => 
          entry.title.toLowerCase().includes(lowercaseQuery) ||
          entry.content.toLowerCase().includes(lowercaseQuery) ||
          entry.taskId.toLowerCase().includes(lowercaseQuery) ||
          entry.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
      },

      // Context Building
      getTaskContext: (agent, taskId) => {
        let memories: TaskMemoryEntry[];
        
        if (taskId) {
          memories = get().getTaskMemory(taskId);
        } else {
          memories = get().getRecentMemory(agent, 5);
        }
        
        return memories.map(memory => 
          `### ${memory.title} (${memory.type})\n${memory.content}`
        ).join('\n\n');
      },

      getSessionContext: (sessionId) => {
        const targetId = sessionId || get().currentSessionId;
        if (!targetId) return '';
        
        const memories = get().getSessionMemory(targetId);
        const session = get().sessions.find(s => s.id === targetId);
        
        const context = session ? `Session Objective: ${session.objective}\n\n` : '';
        
        return context + memories.map(memory => 
          `### ${memory.title}\n${memory.content}`
        ).join('\n\n');
      },

      getAgentWorkHistory: (agent, days = 7) => {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        return get().entries
          .filter(entry => 
            entry.agent === agent && 
            entry.createdAt >= cutoffTime
          )
          .sort((a, b) => b.createdAt - a.createdAt);
      },

      // Analytics
      getTaskStats: (agent) => {
        let entries = get().entries;
        
        if (agent) {
          entries = entries.filter(entry => entry.agent === agent);
        }
        
        const tasks = entries.filter(entry => entry.type !== 'task_progress');
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(entry => entry.status === 'completed').length;
        const activeTasks = tasks.filter(entry => entry.status === 'active').length;
        const failedTasks = tasks.filter(entry => entry.status === 'failed').length;
        
        const tasksWithTime = tasks.filter(entry => entry.metadata?.actualTime);
        const averageTaskTime = tasksWithTime.length > 0 
          ? tasksWithTime.reduce((sum, entry) => sum + (entry.metadata?.actualTime || 0), 0) / tasksWithTime.length 
          : 0;
        
        const mostRecentActivity = tasks.length > 0 
          ? Math.max(...tasks.map(entry => entry.createdAt))
          : 0;
        
        return {
          totalTasks,
          completedTasks,
          activeTasks,
          failedTasks,
          averageTaskTime,
          mostRecentActivity
        };
      },

      // Settings
      setMaxEntries: (max) => {
        set((state) => {
          let newEntries = state.entries;
          if (newEntries.length > max) {
            newEntries = newEntries.slice(-max);
          }
          return { maxEntries: max, entries: newEntries };
        });
      },

      setMaxSessions: (max) => {
        set((state) => {
          let newSessions = state.sessions;
          if (newSessions.length > max) {
            newSessions = newSessions.slice(-max);
          }
          return { maxSessions: max, sessions: newSessions };
        });
      }
    }),
    {
      name: 'task-memory-storage',
      version: 1,
    }
  )
);

// Convenience hooks for specific functionality
export const useTaskMemory = () => {
  const store = useTaskMemoryStore();
  return {
    addTaskMemory: store.addTaskMemory,
    updateTaskMemory: store.updateTaskMemory,
    getAgentMemory: store.getAgentMemory,
    getTaskContext: store.getTaskContext,
    getSessionContext: store.getSessionContext,
  };
};

export const useTaskSession = () => {
  const store = useTaskMemoryStore();
  return {
    startSession: store.startSession,
    endSession: store.endSession,
    pauseSession: store.pauseSession,
    resumeSession: store.resumeSession,
    getCurrentSession: store.getCurrentSession,
  };
};