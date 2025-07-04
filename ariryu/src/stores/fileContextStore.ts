import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { extractRoutesFromFile, ApiRoute, isApiFile } from '../utils/routeParser';

export interface FileRecord {
  path: string;
  content: string;
  lastUpdatedBy: string;
  timestamp: number;
  language?: string;
  size: number;
  lineCount: number;
  routes?: ApiRoute[]; // API routes extracted from this file
  metadata?: {
    isNew?: boolean;
    hasUnsavedChanges?: boolean;
    lastSavedTimestamp?: number;
    conflictResolution?: 'user' | 'agent' | 'merge';
    tags?: string[];
    dependencies?: string[];
    isApiFile?: boolean; // Whether this file contains API routes
  };
}

export interface FileChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  file: FileRecord;
  previousContent?: string;
  changedBy: string;
  timestamp: number;
}

export interface FileContextState {
  files: Record<string, FileRecord>;
  changeHistory: FileChangeEvent[];
  subscribedAgents: Set<string>;
  maxHistoryEntries: number;
  
  // Core File Operations
  updateFile: (path: string, content: string, updatedBy: string, language?: string) => void;
  createFile: (path: string, content: string, createdBy: string, language?: string) => void;
  deleteFile: (path: string, deletedBy: string) => void;
  getFile: (path: string) => FileRecord | undefined;
  
  // File Queries
  getAllFiles: () => Record<string, FileRecord>;
  getFilesByAgent: (agentId: string) => FileRecord[];
  getRecentFiles: (limit?: number) => FileRecord[];
  getFilesByLanguage: (language: string) => FileRecord[];
  searchFiles: (query: string) => FileRecord[];
  
  // Change Tracking
  getChangeHistory: (filePath?: string) => FileChangeEvent[];
  getFileChangesBy: (agentId: string) => FileChangeEvent[];
  getRecentChanges: (limit?: number) => FileChangeEvent[];
  
  // Agent Subscriptions
  subscribeAgent: (agentId: string) => void;
  unsubscribeAgent: (agentId: string) => void;
  getSubscribedAgents: () => string[];
  
  // File Analysis
  getFileStats: () => {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
    languageBreakdown: Record<string, number>;
    agentContributions: Record<string, number>;
  };
  
  // API Route Management
  getAllRoutes: () => ApiRoute[];
  getRoutesByFile: (filePath: string) => ApiRoute[];
  getRoutesByMethod: (method: string) => ApiRoute[];
  searchRoutes: (query: string) => ApiRoute[];
  getApiFiles: () => FileRecord[];
  
  // Utilities
  clearFiles: () => void;
  setMaxHistory: (max: number) => void;
  getFileDependencies: (filePath: string) => string[];
  markFileAsSaved: (filePath: string) => void;
}

export const useFileContext = create<FileContextState>()(
  persist(
    (set, get) => ({
      files: {},
      changeHistory: [],
      subscribedAgents: new Set(),
      maxHistoryEntries: 500,

      updateFile: (path, content, updatedBy, language) => {
        const existingFile = get().files[path];
        const previousContent = existingFile?.content;
        
        // Extract API routes if this is an API file
        const detectedLanguage = language || existingFile?.language || getLanguageFromPath(path);
        const routes = isApiFile(path) ? extractRoutesFromFile(path, content) : [];
        
        const fileRecord: FileRecord = {
          path,
          content,
          lastUpdatedBy: updatedBy,
          timestamp: Date.now(),
          language: detectedLanguage,
          size: content.length,
          lineCount: content.split('\n').length,
          routes,
          metadata: {
            ...existingFile?.metadata,
            hasUnsavedChanges: true,
            isNew: !existingFile,
            isApiFile: routes.length > 0
          }
        };

        // Create change event
        const changeEvent: FileChangeEvent = {
          type: existingFile ? 'updated' : 'created',
          file: fileRecord,
          previousContent,
          changedBy: updatedBy,
          timestamp: Date.now()
        };

        set((state) => {
          let newHistory = [...state.changeHistory, changeEvent];
          
          // Trim history if too long
          if (newHistory.length > state.maxHistoryEntries) {
            newHistory = newHistory.slice(-state.maxHistoryEntries);
          }

          return {
            files: { ...state.files, [path]: fileRecord },
            changeHistory: newHistory
          };
        });

        // Notify message bus about file change
        notifyMessageBus(changeEvent);
      },

      createFile: (path, content, createdBy, language) => {
        get().updateFile(path, content, createdBy, language);
      },

      deleteFile: (path, deletedBy) => {
        const existingFile = get().files[path];
        if (!existingFile) return;

        const changeEvent: FileChangeEvent = {
          type: 'deleted',
          file: existingFile,
          changedBy: deletedBy,
          timestamp: Date.now()
        };

        set((state) => {
          const newFiles = { ...state.files };
          delete newFiles[path];
          
          let newHistory = [...state.changeHistory, changeEvent];
          if (newHistory.length > state.maxHistoryEntries) {
            newHistory = newHistory.slice(-state.maxHistoryEntries);
          }

          return {
            files: newFiles,
            changeHistory: newHistory
          };
        });

        // Notify message bus about file deletion
        notifyMessageBus(changeEvent);
      },

      getFile: (path) => {
        return get().files[path];
      },

      getAllFiles: () => {
        return get().files;
      },

      getFilesByAgent: (agentId) => {
        const files = get().files;
        return Object.values(files).filter(file => file.lastUpdatedBy === agentId);
      },

      getRecentFiles: (limit = 10) => {
        const files = Object.values(get().files);
        return files
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      getFilesByLanguage: (language) => {
        const files = get().files;
        return Object.values(files).filter(file => file.language === language);
      },

      searchFiles: (query) => {
        const lowercaseQuery = query.toLowerCase();
        const files = get().files;
        return Object.values(files).filter(file => 
          file.path.toLowerCase().includes(lowercaseQuery) ||
          file.content.toLowerCase().includes(lowercaseQuery) ||
          file.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
      },

      getChangeHistory: (filePath) => {
        const history = get().changeHistory;
        if (filePath) {
          return history.filter(change => change.file.path === filePath);
        }
        return history;
      },

      getFileChangesBy: (agentId) => {
        return get().changeHistory.filter(change => change.changedBy === agentId);
      },

      getRecentChanges: (limit = 20) => {
        const history = get().changeHistory;
        return history.slice(-limit).reverse();
      },

      subscribeAgent: (agentId) => {
        set((state) => ({
          subscribedAgents: new Set([...state.subscribedAgents, agentId])
        }));
      },

      unsubscribeAgent: (agentId) => {
        set((state) => {
          const newSubscribers = new Set(state.subscribedAgents);
          newSubscribers.delete(agentId);
          return { subscribedAgents: newSubscribers };
        });
      },

      getSubscribedAgents: () => {
        return Array.from(get().subscribedAgents);
      },

      getFileStats: () => {
        const files = Object.values(get().files);
        const stats = {
          totalFiles: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          totalLines: files.reduce((sum, file) => sum + file.lineCount, 0),
          languageBreakdown: {} as Record<string, number>,
          agentContributions: {} as Record<string, number>
        };

        files.forEach(file => {
          // Language breakdown
          if (file.language) {
            stats.languageBreakdown[file.language] = (stats.languageBreakdown[file.language] || 0) + 1;
          }
          
          // Agent contributions
          stats.agentContributions[file.lastUpdatedBy] = (stats.agentContributions[file.lastUpdatedBy] || 0) + 1;
        });

        return stats;
      },

      clearFiles: () => {
        set({ files: {}, changeHistory: [] });
      },

      setMaxHistory: (max) => {
        set((state) => {
          let newHistory = state.changeHistory;
          if (newHistory.length > max) {
            newHistory = newHistory.slice(-max);
          }
          return { maxHistoryEntries: max, changeHistory: newHistory };
        });
      },

      getFileDependencies: (filePath) => {
        const file = get().files[filePath];
        return file?.metadata?.dependencies || [];
      },

      markFileAsSaved: (filePath) => {
        const file = get().files[filePath];
        if (file) {
          set((state) => ({
            files: {
              ...state.files,
              [filePath]: {
                ...file,
                metadata: {
                  ...file.metadata,
                  hasUnsavedChanges: false,
                  lastSavedTimestamp: Date.now()
                }
              }
            }
          }));
        }
      },

      // API Route Management Methods
      getAllRoutes: () => {
        const files = Object.values(get().files);
        return files.flatMap(file => file.routes || []);
      },

      getRoutesByFile: (filePath) => {
        const file = get().files[filePath];
        return file?.routes || [];
      },

      getRoutesByMethod: (method) => {
        const allRoutes = get().getAllRoutes();
        return allRoutes.filter(route => 
          route.method.toLowerCase() === method.toLowerCase()
        );
      },

      searchRoutes: (query) => {
        const lowercaseQuery = query.toLowerCase();
        const allRoutes = get().getAllRoutes();
        return allRoutes.filter(route =>
          route.path.toLowerCase().includes(lowercaseQuery) ||
          route.method.toLowerCase().includes(lowercaseQuery) ||
          route.description?.toLowerCase().includes(lowercaseQuery) ||
          route.fileName.toLowerCase().includes(lowercaseQuery)
        );
      },

      getApiFiles: () => {
        const files = Object.values(get().files);
        return files.filter(file => file.metadata?.isApiFile || (file.routes && file.routes.length > 0));
      }
    }),
    {
      name: 'file-context-storage',
      version: 1,
      // Don't persist subscribed agents set
      partialize: (state) => ({
        files: state.files,
        changeHistory: state.changeHistory,
        maxHistoryEntries: state.maxHistoryEntries
      })
    }
  )
);

// Helper function to determine language from file path
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'tsx':
    case 'ts':
      return 'typescript';
    case 'jsx':
    case 'js':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'vue':
      return 'vue';
    case 'svelte':
      return 'svelte';
    default:
      return 'plaintext';
  }
}

// Helper hooks for common use cases
export const useFileWatcher = (filePath: string) => {
  const file = useFileContext(state => state.files[filePath]);
  return file;
};

export const useFilesByAgent = (agentId: string) => {
  return useFileContext(state => state.getFilesByAgent(agentId));
};

export const useRecentFileChanges = (limit?: number) => {
  return useFileContext(state => state.getRecentChanges(limit));
};

// Message bus integration for file change notifications
function notifyMessageBus(changeEvent: FileChangeEvent) {
  // Import the message bus dynamically to avoid circular dependencies
  import('./messageBus').then(({ useMessageBus, MessagePatterns }) => {
    const { sendMessage, getSubscribedAgents: getBusAgents } = useMessageBus.getState();
    const { getSubscribedAgents } = useFileContext.getState();
    
    const subscribedAgents = getSubscribedAgents();
    const fileName = changeEvent.file.path.split('/').pop() || changeEvent.file.path;
    
    // Send notification to all subscribed agents (except the one who made the change)
    subscribedAgents.forEach(agentId => {
      if (agentId === changeEvent.changedBy) return; // Don't notify the agent who made the change
      
      const message = MessagePatterns.fileUpdate(
        'FILE_CONTEXT',
        changeEvent.file.path,
        `File ${changeEvent.type}: ${fileName} by ${changeEvent.changedBy} (${changeEvent.file.lineCount} lines, ${changeEvent.file.language})`,
        agentId,
        {
          changeType: changeEvent.type,
          fileSize: changeEvent.file.size,
          lineCount: changeEvent.file.lineCount,
          language: changeEvent.file.language,
          lastUpdatedBy: changeEvent.file.lastUpdatedBy,
          tags: ['file-context-notification', 'real-time-update']
        }
      );
      
      sendMessage(message);
    });
  }).catch(error => {
    console.warn('Failed to notify message bus about file change:', error);
  });
  
  // Notify agent observer for feedback generation (with safety checks)
  if (changeEvent.type === 'updated' || changeEvent.type === 'created') {
    import('../utils/agentObserver').then(({ agentObserver }) => {
      agentObserver.observeFileChange(changeEvent.file);
    }).catch(error => {
      console.warn('Failed to notify agent observer:', error);
    });
  }
}