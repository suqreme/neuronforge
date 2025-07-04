import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentMessage {
  id: string;
  sender: string;
  receiver: string;
  type: 'task' | 'file_update' | 'context' | 'log' | 'completion' | 'error' | 'request' | 'response' | 'summary' | 'suggestions' | 'code_patch' | 'reflection' | 'feedback';
  content: string;
  timestamp: number;
  priority?: 'low' | 'medium' | 'high';
  metadata?: {
    filePath?: string;
    taskId?: string;
    agentType?: string;
    sessionId?: string;
    correlationId?: string;
    tags?: string[];
    codeQualityScore?: number;
    urgentIssueCount?: number;
    confidence?: number;
    analysisScore?: number;
    suggestionCount?: number;
    suggestionId?: string;
    suggestionTitle?: string;
    targetFiles?: string[];
    action?: string;
    originalQuestion?: string;
    target?: string;
    redundantCount?: number;
    unusedCount?: number;
    codeQuality?: number;
    // Additional metadata properties for various agents
    reason?: string;
    actionReason?: string;
    status?: string;
    highPriorityActions?: number;
    actionCount?: number;
    actionType?: string;
    fileCount?: number;
    // More metadata properties for compatibility
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

export interface MessageFilter {
  sender?: string;
  receiver?: string;
  type?: AgentMessage['type'];
  priority?: AgentMessage['priority'];
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface MessageBusState {
  messages: AgentMessage[];
  maxMessages: number;
  activeAgents: Set<string>;
  messageListeners: Map<string, (message: AgentMessage) => void>;
  
  // Core Actions
  sendMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  
  // Agent Management
  registerAgent: (agentId: string) => void;
  unregisterAgent: (agentId: string) => void;
  getActiveAgents: () => string[];
  
  // Message Filtering & Search
  getMessagesByFilter: (filter: MessageFilter) => AgentMessage[];
  getMessagesBetween: (sender: string, receiver: string) => AgentMessage[];
  getRecentMessages: (limit?: number) => AgentMessage[];
  searchMessages: (query: string) => AgentMessage[];
  
  // Listeners
  addMessageListener: (listenerId: string, callback: (message: AgentMessage) => void) => void;
  removeMessageListener: (listenerId: string) => void;
  
  // Analytics
  getMessageCount: () => number;
  getMessageStats: () => {
    total: number;
    byType: Record<string, number>;
    bySender: Record<string, number>;
    byReceiver: Record<string, number>;
  };
  
  // Settings
  setMaxMessages: (max: number) => void;
}

export const useMessageBus = create<MessageBusState>()(
  persist(
    (set, get) => ({
      messages: [],
      maxMessages: 1000,
      activeAgents: new Set(),
      messageListeners: new Map(),

      sendMessage: (msg) => {
        const newMessage: AgentMessage = {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          priority: msg.priority || 'medium'
        };

        set((state) => {
          let newMessages = [...state.messages, newMessage];
          
          // Trim messages if exceeding max
          if (newMessages.length > state.maxMessages) {
            newMessages = newMessages.slice(-state.maxMessages);
          }
          
          return { messages: newMessages };
        });

        // Notify listeners
        const listeners = get().messageListeners;
        listeners.forEach(callback => {
          try {
            callback(newMessage);
          } catch (error) {
            console.error('Message listener error:', error);
          }
        });
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      removeMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter(msg => msg.id !== id)
        }));
      },

      registerAgent: (agentId) => {
        const state = get();
        
        // Prevent duplicate registrations
        if (state.activeAgents.has(agentId)) {
          return; // Already registered
        }
        
        set((state) => {
          const newActiveAgents = new Set(state.activeAgents);
          newActiveAgents.add(agentId);
          return { activeAgents: newActiveAgents };
        });
        
        // Send registration message
        get().sendMessage({
          sender: 'MESSAGE_BUS',
          receiver: 'ALL',
          type: 'log',
          content: `Agent ${agentId} registered`,
          metadata: { agentType: 'system', tags: ['agent-lifecycle'] }
        });
      },

      unregisterAgent: (agentId) => {
        const state = get();
        
        // Prevent duplicate unregistrations
        if (!state.activeAgents.has(agentId)) {
          return; // Not registered
        }
        
        set((state) => {
          const newActiveAgents = new Set(state.activeAgents);
          newActiveAgents.delete(agentId);
          return { activeAgents: newActiveAgents };
        });
        
        // Send unregistration message
        get().sendMessage({
          sender: 'MESSAGE_BUS',
          receiver: 'ALL',
          type: 'log',
          content: `Agent ${agentId} unregistered`,
          metadata: { agentType: 'system', tags: ['agent-lifecycle'] }
        });
      },

      getActiveAgents: () => {
        return Array.from(get().activeAgents);
      },

      getMessagesByFilter: (filter) => {
        const messages = get().messages;
        return messages.filter(msg => {
          if (filter.sender && msg.sender !== filter.sender) return false;
          if (filter.receiver && msg.receiver !== filter.receiver) return false;
          if (filter.type && msg.type !== filter.type) return false;
          if (filter.priority && msg.priority !== filter.priority) return false;
          if (filter.timeRange) {
            if (msg.timestamp < filter.timeRange.start || msg.timestamp > filter.timeRange.end) {
              return false;
            }
          }
          return true;
        });
      },

      getMessagesBetween: (sender, receiver) => {
        const messages = get().messages;
        return messages.filter(msg => 
          (msg.sender === sender && msg.receiver === receiver) ||
          (msg.sender === receiver && msg.receiver === sender)
        );
      },

      getRecentMessages: (limit = 50) => {
        const messages = get().messages;
        return messages.slice(-limit).reverse();
      },

      searchMessages: (query) => {
        const lowercaseQuery = query.toLowerCase();
        const messages = get().messages;
        return messages.filter(msg => 
          msg.content.toLowerCase().includes(lowercaseQuery) ||
          msg.sender.toLowerCase().includes(lowercaseQuery) ||
          msg.receiver.toLowerCase().includes(lowercaseQuery) ||
          msg.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
      },

      addMessageListener: (listenerId, callback) => {
        set((state) => {
          const newListeners = new Map(state.messageListeners);
          newListeners.set(listenerId, callback);
          return { messageListeners: newListeners };
        });
      },

      removeMessageListener: (listenerId) => {
        set((state) => {
          const newListeners = new Map(state.messageListeners);
          newListeners.delete(listenerId);
          return { messageListeners: newListeners };
        });
      },

      getMessageCount: () => {
        return get().messages.length;
      },

      getMessageStats: () => {
        const messages = get().messages;
        const stats = {
          total: messages.length,
          byType: {} as Record<string, number>,
          bySender: {} as Record<string, number>,
          byReceiver: {} as Record<string, number>
        };

        messages.forEach(msg => {
          // Count by type
          stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
          
          // Count by sender
          stats.bySender[msg.sender] = (stats.bySender[msg.sender] || 0) + 1;
          
          // Count by receiver
          stats.byReceiver[msg.receiver] = (stats.byReceiver[msg.receiver] || 0) + 1;
        });

        return stats;
      },

      setMaxMessages: (max) => {
        set((state) => {
          let newMessages = state.messages;
          if (newMessages.length > max) {
            newMessages = newMessages.slice(-max);
          }
          return { maxMessages: max, messages: newMessages };
        });
      }
    }),
    {
      name: 'message-bus-storage',
      version: 1,
      // Don't persist listeners and active agents
      partialize: (state) => ({
        messages: state.messages,
        maxMessages: state.maxMessages
      })
    }
  )
);

// Helper functions for common agent types
export const AGENT_TYPES = {
  CLAUDE: 'CLAUDE_ASSISTANT',
  UI_AGENT: 'UI_AGENT',
  BACKEND_AGENT: 'BACKEND_AGENT',
  MEMORY_AGENT: 'MEMORY_AGENT',
  FILE_AGENT: 'FILE_AGENT',
  SANDBOX: 'SANDBOX',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  MESSAGE_BUS: 'MESSAGE_BUS',
  CLAUDE_REFLECTION: 'CLAUDE_REFLECTION'
} as const;

// Helper function to create structured messages
export const createMessage = (
  sender: string,
  receiver: string,
  type: AgentMessage['type'],
  content: string,
  metadata?: AgentMessage['metadata']
): Omit<AgentMessage, 'id' | 'timestamp'> => ({
  sender,
  receiver,
  type,
  content,
  metadata
});

// Common message patterns
export const MessagePatterns = {
  taskAssignment: (from: string, to: string, task: string, taskId?: string) =>
    createMessage(from, to, 'task', task, { taskId, tags: ['task-assignment'] }),
    
  fileUpdate: (from: string, filePath: string, description: string) =>
    createMessage(from, 'ALL', 'file_update', description, { filePath, tags: ['file-change'] }),
    
  completion: (from: string, to: string, result: string, taskId?: string) =>
    createMessage(from, to, 'completion', result, { taskId, tags: ['task-completion'] }),
    
  error: (from: string, to: string, error: string, taskId?: string) =>
    createMessage(from, to, 'error', error, { taskId, tags: ['error'] }),
    
  log: (from: string, message: string, tags?: string[]) =>
    createMessage(from, 'ALL', 'log', message, { tags: ['log', ...(tags || [])] })
};