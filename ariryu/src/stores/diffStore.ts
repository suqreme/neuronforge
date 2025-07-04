import { create } from 'zustand';

export interface PendingDiff {
  id: string;
  path: string;
  oldContent: string;
  newContent: string;
  reason?: string;
  timestamp: number;
}

interface DiffState {
  pendingDiffs: PendingDiff[];
  currentDiffId: string | null;
  isModalOpen: boolean;
  
  // Actions
  addPendingDiff: (diff: Omit<PendingDiff, 'id' | 'timestamp'>) => string;
  removePendingDiff: (id: string) => void;
  openDiffModal: (diffId: string) => void;
  closeDiffModal: () => void;
  clearAllDiffs: () => void;
  
  // Getters
  getCurrentDiff: () => PendingDiff | null;
  getPendingDiffsCount: () => number;
}

export const useDiffStore = create<DiffState>((set, get) => ({
  pendingDiffs: [],
  currentDiffId: null,
  isModalOpen: false,

  addPendingDiff: (diff) => {
    const id = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newDiff: PendingDiff = {
      ...diff,
      id,
      timestamp: Date.now()
    };
    
    set(state => ({
      pendingDiffs: [...state.pendingDiffs, newDiff]
    }));
    
    return id;
  },

  removePendingDiff: (id) => {
    set(state => ({
      pendingDiffs: state.pendingDiffs.filter(diff => diff.id !== id),
      currentDiffId: state.currentDiffId === id ? null : state.currentDiffId,
      isModalOpen: state.currentDiffId === id ? false : state.isModalOpen
    }));
  },

  openDiffModal: (diffId) => {
    set({
      currentDiffId: diffId,
      isModalOpen: true
    });
  },

  closeDiffModal: () => {
    set({
      currentDiffId: null,
      isModalOpen: false
    });
  },

  clearAllDiffs: () => {
    set({
      pendingDiffs: [],
      currentDiffId: null,
      isModalOpen: false
    });
  },

  getCurrentDiff: () => {
    const state = get();
    if (!state.currentDiffId) return null;
    return state.pendingDiffs.find(diff => diff.id === state.currentDiffId) || null;
  },

  getPendingDiffsCount: () => {
    return get().pendingDiffs.length;
  }
}));