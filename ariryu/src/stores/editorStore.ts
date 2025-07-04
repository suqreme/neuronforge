import { create } from 'zustand';
import { EditorFile } from '../types';

interface EditorState {
  openTabs: EditorFile[];
  activePath: string | null;
  isLoading: boolean;
}

interface EditorActions {
  openFile: (file: EditorFile) => void;
  closeFile: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  setActivePath: (path: string) => void;
  clearAllFiles: () => void;
  getAllFiles: () => EditorFile[];
  loadFiles: (files: EditorFile[]) => void;
}

const mockFiles: EditorFile[] = [
  {
    path: 'src/App.tsx',
    content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to NeuronForge</h1>
        <p>Your AI-powered development platform</p>
      </header>
    </div>
  );
}

export default App;`,
    language: 'typescript',
    isDirty: false,
  },
  {
    path: 'src/components/Button.tsx',
    content: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button 
      onClick={onClick}
      className={\`px-4 py-2 rounded \${
        variant === 'primary' 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-200 text-gray-800'
      }\`}
    >
      {children}
    </button>
  );
};

export default Button;`,
    language: 'typescript',
    isDirty: false,
  },
];

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  openTabs: mockFiles,
  activePath: 'src/App.tsx',
  isLoading: false,

  openFile: (file) => {
    set((state) => {
      // Check if file is already open
      const existingTab = state.openTabs.find(tab => tab.path === file.path);
      if (existingTab) {
        return { activePath: file.path };
      }
      
      // Add new file to tabs
      return {
        openTabs: [...state.openTabs, file],
        activePath: file.path,
      };
    });
  },

  closeFile: (path) => {
    set((state) => {
      const newTabs = state.openTabs.filter(tab => tab.path !== path);
      const newActivePath = state.activePath === path 
        ? (newTabs.length > 0 ? newTabs[0].path : null)
        : state.activePath;
      
      return {
        openTabs: newTabs,
        activePath: newActivePath,
      };
    });
  },

  updateContent: (path, content) => {
    set((state) => ({
      openTabs: state.openTabs.map(tab =>
        tab.path === path 
          ? { ...tab, content, isDirty: true }
          : tab
      ),
    }));
  },

  setActivePath: (path) => {
    set({ activePath: path });
  },

  clearAllFiles: () => {
    set({ openTabs: [], activePath: null });
  },

  getAllFiles: () => {
    return get().openTabs;
  },

  loadFiles: (files) => {
    set({ 
      openTabs: files,
      activePath: files.length > 0 ? files[0].path : null
    });
  },
}));