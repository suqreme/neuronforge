import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  type: 'user_request' | 'claude_response' | 'file_action' | 'project_update' | 'general' | 'auto_execution' | 'code_review' | 'planning' | 'task_start' | 'task_progress' | 'task_complete' | 'file_generation' | 'critique' | 'error';
  agentType?: 'CLAUDE' | 'CRITIC' | 'SUMMARIZER' | 'REFLECTION' | 'PLANNER' | 'GENERAL'; // Type tagging for memory segregation
  metadata?: {
    filePath?: string;
    actionType?: string;
    importance?: 'low' | 'medium' | 'high';
    tags?: string[];
    status?: string;
    originalQuestion?: string;
    actionCount?: number;
    overallScore?: number;
    target?: string;
    // Task-specific metadata
    taskId?: string;
    agent?: string;
    title?: string;
    parentTaskId?: string;
    estimatedTime?: string;
    actualTime?: number;
    dependencies?: string[];
    relatedFiles?: string[];
    critiqueScore?: number;
    confidence?: number;
    // Additional metadata for compatibility
    reason?: string;
    actionReason?: string;
    highPriorityActions?: number;
    fileCount?: number;
    suggestionCount?: number;
    suggestionId?: string;
    suggestionTitle?: string;
    targetFiles?: string[];
    action?: string;
    redundantCount?: number;
    unusedCount?: number;
    codeQuality?: number;
    codeQualityScore?: number;
    urgentIssueCount?: number;
    analysisScore?: number;
    // Even more metadata for full compatibility
    timestamp?: number;
    generatedContent?: string;
    overallScore?: number;
    hasImprovedContent?: boolean;
    summaryScore?: number;
    changeType?: string;
    changedBy?: string;
    fileSize?: number;
    lineCount?: number;
    language?: string;
    needsReview?: boolean;
  };
}

export interface MemoryState {
  entries: MemoryEntry[];
  maxEntries: number;
  autoSummaryCount: number;
  autoSummaryThreshold: number;
  lastAutoSummaryTime: number;
  
  // Actions
  addMemory: (content: string, type?: MemoryEntry['type'], metadata?: MemoryEntry['metadata'], agentType?: MemoryEntry['agentType']) => void;
  removeMemory: (id: string) => void;
  clearMemory: () => void;
  updateMemory: (id: string, updates: Partial<MemoryEntry>) => void;
  
  // Getters
  getMemoryByType: (type: MemoryEntry['type']) => MemoryEntry[];
  getMemoryByAgent: (agentType: MemoryEntry['agentType']) => MemoryEntry[];
  getRecentMemory: (agentType?: MemoryEntry['agentType'], limit?: number) => MemoryEntry[];
  searchMemory: (query: string) => MemoryEntry[];
  getMemoryCount: () => number;
  getAllEntries: () => MemoryEntry[];
  
  // Task Memory Functions (unified from taskMemoryStore)
  addTaskMemory: (entry: { agent: string; taskId: string; title: string; content: string; type: MemoryEntry['type']; status: string; metadata?: MemoryEntry['metadata'] }) => string;
  updateTaskMemory: (id: string, updates: Partial<MemoryEntry>) => void;
  getTaskMemory: (agent: string, limit?: number) => MemoryEntry[];
  
  // Settings
  setMaxEntries: (max: number) => void;
  setAutoSummaryThreshold: (threshold: number) => void;
  resetAutoSummaryCounter: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: 100,
      autoSummaryCount: 0,
      autoSummaryThreshold: 10, // Trigger summary every 10 significant memory entries
      lastAutoSummaryTime: 0,

      addMemory: (content, type = 'general', metadata = {}, agentType = 'GENERAL') => {
        const newEntry: MemoryEntry = {
          id: crypto.randomUUID(),
          content,
          type,
          agentType,
          timestamp: Date.now(),
          metadata: {
            importance: 'medium',
            ...metadata
          }
        };

        set((state) => {
          let newEntries = [...state.entries, newEntry];
          
          // Trim entries if exceeding max
          if (newEntries.length > state.maxEntries) {
            newEntries = newEntries.slice(-state.maxEntries);
          }
          
          // Increment auto-summary counter for significant activities
          const isSignificant = ['file_action', 'claude_response', 'project_update'].includes(type) ||
                                metadata?.importance === 'high';
          
          const newAutoSummaryCount = isSignificant ? state.autoSummaryCount + 1 : state.autoSummaryCount;
          
          // DISABLED: Auto-summary system to prevent token usage loops
          // TODO: Re-enable with proper safeguards and user control
          const shouldTriggerSummary = false; // DISABLED for token safety
          
          if (shouldTriggerSummary) {
            // DISABLED: Auto-summarizer to prevent expensive token loops
            
            return { 
              entries: newEntries,
              autoSummaryCount: 0, // Reset counter
              lastAutoSummaryTime: Date.now()
            };
          }
          
          return { 
            entries: newEntries,
            autoSummaryCount: newAutoSummaryCount
          };
        });
      },

      removeMemory: (id) => {
        set((state) => ({
          entries: state.entries.filter(entry => entry.id !== id)
        }));
      },

      clearMemory: () => {
        set({ entries: [] });
      },

      updateMemory: (id, updates) => {
        set((state) => ({
          entries: state.entries.map(entry => 
            entry.id === id ? { ...entry, ...updates } : entry
          )
        }));
      },

      getMemoryByType: (type) => {
        return get().entries.filter(entry => entry.type === type);
      },

      getMemoryByAgent: (agentType) => {
        return get().entries.filter(entry => entry.agentType === agentType);
      },

      getRecentMemory: (agentType, limit = 10) => {
        const entries = get().entries;
        const filtered = agentType ? entries.filter(e => e.agentType === agentType) : entries;
        return filtered.slice(-limit).reverse();
      },

      searchMemory: (query) => {
        const lowercaseQuery = query.toLowerCase();
        return get().entries.filter(entry => 
          entry.content.toLowerCase().includes(lowercaseQuery) ||
          entry.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
      },

      getMemoryCount: () => {
        return get().entries.length;
      },

      getAllEntries: () => {
        return get().entries;
      },

      // Task Memory Functions (unified from taskMemoryStore)
      addTaskMemory: (entry) => {
        const id = crypto.randomUUID();
        const taskEntry: MemoryEntry = {
          id,
          content: entry.content,
          type: entry.type,
          agentType: entry.agent as MemoryEntry['agentType'],
          timestamp: Date.now(),
          metadata: {
            importance: 'medium',
            taskId: entry.taskId,
            agent: entry.agent,
            title: entry.title,
            status: entry.status,
            ...entry.metadata
          }
        };
        
        set((state) => {
          let newEntries = [...state.entries, taskEntry];
          if (newEntries.length > state.maxEntries) {
            newEntries = newEntries.slice(-state.maxEntries);
          }
          return { entries: newEntries };
        });
        
        return id;
      },

      updateTaskMemory: (id, updates) => {
        set((state) => ({
          entries: state.entries.map(entry => 
            entry.id === id ? { ...entry, ...updates } : entry
          )
        }));
      },

      getTaskMemory: (agent, limit = 10) => {
        const entries = get().entries.filter(entry => 
          entry.metadata?.agent === agent || entry.agentType === agent
        );
        return entries.slice(-limit).reverse();
      },

      setMaxEntries: (max) => {
        set((state) => {
          let newEntries = state.entries;
          if (newEntries.length > max) {
            newEntries = newEntries.slice(-max);
          }
          return { maxEntries: max, entries: newEntries };
        });
      },

      setAutoSummaryThreshold: (threshold) => {
        set({ autoSummaryThreshold: threshold });
      },

      resetAutoSummaryCounter: () => {
        set({ autoSummaryCount: 0 });
      }
    }),
    {
      name: 'claude-memory-storage',
      version: 1,
    }
  )
);

// Backward compatibility exports for taskMemoryStore
export const useTaskMemoryStore = {
  getState: () => {
    const state = useMemoryStore.getState();
    return {
      addTaskMemory: state.addTaskMemory,
      updateTaskMemory: state.updateTaskMemory,
      getRecentMemory: (agent: string, limit?: number) => state.getTaskMemory(agent, limit),
      removeTaskMemory: state.removeMemory,
      clearTaskMemory: state.clearMemory,
      // Session management functions (simplified)
      startSession: (agent: string, objective: string) => {
        const sessionId = crypto.randomUUID();
        state.addMemory(`Started session: ${objective}`, 'task_start', {
          taskId: sessionId,
          agent,
          title: 'Session Start',
          status: 'active'
        }, agent as MemoryEntry['agentType']);
        return sessionId;
      },
      getCurrentSession: () => null, // Simplified - sessions are tracked via memory entries
      getSessionContext: () => '', // Simplified
      endSession: (sessionId: string) => {
        state.addMemory('Session ended', 'task_complete', {
          taskId: sessionId,
          status: 'completed'
        });
      }
    };
  }
};

// Backward compatibility for selfCritiqueStore
export const useSelfCritiqueStore = {
  getState: () => ({
    settings: {
      enabled: true,
      autoReviewOnSave: false,
      autoReviewThreshold: 7,
      autoImproveEnabled: false,
      reviewNewFiles: true,
      reviewFileTypes: ['.tsx', '.ts', '.js', '.jsx'],
      skipLargeFiles: true,
      maxFileSize: 5000,
      batchReviewEnabled: false,
      confidence: 0.7,
      notificationsEnabled: true
    },
    updateSettings: () => {},
    resetSettings: () => {},
    stats: {
      totalReviews: 0,
      approved: 0,
      needsImprovement: 0,
      rejected: 0,
      autoImprovements: 0,
      averageScore: 7,
      averageConfidence: 0.8,
      filesReviewed: [],
      lastReviewTime: Date.now()
    },
    updateStats: () => {},
    resetStats: () => {},
    addReviewResult: () => {},
    shouldReviewFile: () => true,
    isFileTypeSupported: () => true,
    getRecentCritiques: () => useMemoryStore.getState().getMemoryByAgent('CRITIC')
  })
};