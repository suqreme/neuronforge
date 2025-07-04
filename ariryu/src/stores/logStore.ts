import { create } from 'zustand';
import { LogMessage } from '../types';

interface LogState {
  logs: LogMessage[];
  maxLogs: number;
  isAutoScroll: boolean;
}

interface LogActions {
  addLog: (message: Omit<LogMessage, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setAutoScroll: (enabled: boolean) => void;
  setMaxLogs: (max: number) => void;
}

// Mock initial logs
const mockLogs: LogMessage[] = [
  {
    id: 'log-1',
    timestamp: Date.now() - 120000, // 2 minutes ago
    level: 'info',
    source: 'System',
    message: 'NeuronForge workbench initialized',
  },
  {
    id: 'log-2',
    timestamp: Date.now() - 60000, // 1 minute ago
    level: 'info',
    source: 'Manager',
    message: 'Project loaded: My NeuronForge App',
    agentId: 'manager-1',
  },
  {
    id: 'log-3',
    timestamp: Date.now() - 30000, // 30 seconds ago
    level: 'agent',
    source: 'UI Agent',
    message: 'Ready to generate React components',
    agentId: 'ui-1',
  },
  {
    id: 'log-4',
    timestamp: Date.now() - 10000, // 10 seconds ago
    level: 'agent',
    source: 'Backend',
    message: 'Standing by for API generation tasks',
    agentId: 'backend-1',
  },
];

export const useLogStore = create<LogState & LogActions>((set, get) => ({
  logs: mockLogs,
  maxLogs: 1000,
  isAutoScroll: true,

  addLog: (logData) => {
    const newLog: LogMessage = {
      ...logData,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set((state) => {
      const newLogs = [...state.logs, newLog];
      
      // Trim logs if they exceed maxLogs
      if (newLogs.length > state.maxLogs) {
        return {
          logs: newLogs.slice(-state.maxLogs),
        };
      }
      
      return { logs: newLogs };
    });
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  setAutoScroll: (enabled) => {
    set({ isAutoScroll: enabled });
  },

  setMaxLogs: (max) => {
    set((state) => {
      const newLogs = state.logs.length > max 
        ? state.logs.slice(-max) 
        : state.logs;
      
      return {
        maxLogs: max,
        logs: newLogs,
      };
    });
  },
}));