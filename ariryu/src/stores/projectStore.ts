import { create } from 'zustand';
import { Project, Agent } from '../types';
import type { ProjectData, SavedAgent } from '../types/project';
import JSZip from 'jszip';

interface ProjectState {
  project: Project | null;
  currentProject: ProjectData | null;
  isLoading: boolean;
}

interface ProjectActions {
  setProject: (project: Project) => void;
  updateProjectStatus: (status: Project['status']) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  removeAgent: (agentId: string) => void;
  clearProject: () => void;
  saveProject: () => void;
  loadProject: (data: ProjectData) => void;
  exportProject: () => void;
}

const mockProject: Project = {
  id: 'project-1',
  name: 'My NeuronForge App',
  description: 'A sample project to demonstrate NeuronForge capabilities',
  status: 'idle',
  agents: [
    {
      id: 'manager-1',
      name: 'Manager Agent',
      type: 'manager',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'ui-1',
      name: 'UI Agent',
      type: 'ui',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'backend-1',
      name: 'Backend Agent',
      type: 'backend',
      status: 'idle',
      progress: 0,
    },
  ],
  createdAt: Date.now() - 86400000, // 1 day ago
  updatedAt: Date.now(),
};

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  project: mockProject,
  currentProject: null,
  isLoading: false,

  setProject: (project) => {
    set({ project });
  },

  updateProjectStatus: (status) => {
    set((state) => 
      state.project 
        ? { 
            project: { 
              ...state.project, 
              status, 
              updatedAt: Date.now() 
            } 
          }
        : state
    );
  },

  addAgent: (agent) => {
    set((state) => 
      state.project 
        ? {
            project: {
              ...state.project,
              agents: [...state.project.agents, agent],
              updatedAt: Date.now(),
            }
          }
        : state
    );
  },

  updateAgent: (agentId, updates) => {
    set((state) => 
      state.project 
        ? {
            project: {
              ...state.project,
              agents: state.project.agents.map(agent =>
                agent.id === agentId 
                  ? { ...agent, ...updates }
                  : agent
              ),
              updatedAt: Date.now(),
            }
          }
        : state
    );
  },

  removeAgent: (agentId) => {
    set((state) => 
      state.project 
        ? {
            project: {
              ...state.project,
              agents: state.project.agents.filter(agent => agent.id !== agentId),
              updatedAt: Date.now(),
            }
          }
        : state
    );
  },

  clearProject: () => {
    set({ project: null });
  },

  saveProject: () => {
    const state = get();
    const { useEditorStore } = require('./editorStore');
    const editorFiles = useEditorStore.getState().getAllFiles();

    // Convert current project state to SavedAgent format
    const agents: SavedAgent[] = state.project?.agents.map(agent => ({
      id: agent.id,
      type: agent.type,
      state: {
        status: agent.status,
        progress: agent.progress
      },
      task: agent.name,
      files: editorFiles.map((file: any) => ({
        path: file.path,
        content: file.content
      }))
    })) || [];

    const saved: ProjectData = {
      id: `project-${Date.now()}`,
      name: state.project?.name || "Untitled Project",
      createdAt: Date.now(),
      agents,
      connections: [] // No connection system yet, placeholder
    };

    set({ currentProject: saved });
    console.log("✅ Project saved:", saved);
    
    // Download as JSON file
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${saved.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  loadProject: (data: ProjectData) => {
    const { useEditorStore } = require('./editorStore');
    
    set({ currentProject: data });
    
    // Restore editor files from all agents
    const allFiles: any[] = [];
    data.agents.forEach(agent => {
      agent.files.forEach(file => {
        allFiles.push({
          path: file.path,
          content: file.content,
          language: file.path.endsWith('.tsx') || file.path.endsWith('.ts') ? 'typescript' : 'javascript',
          isDirty: false
        });
      });
    });

    if (allFiles.length > 0) {
      useEditorStore.getState().loadFiles(allFiles);
    }

    // Restore project state
    const restoredProject: Project = {
      id: data.id,
      name: data.name,
      description: 'Restored project',
      status: 'idle',
      agents: data.agents.map(savedAgent => ({
        id: savedAgent.id,
        name: savedAgent.task,
        type: savedAgent.type as any,
        status: savedAgent.state?.status || 'idle',
        progress: savedAgent.state?.progress || 0
      })),
      createdAt: data.createdAt,
      updatedAt: Date.now()
    };

    set({ project: restoredProject });
    console.log("✅ Project loaded:", data);
  },

  exportProject: () => {
    const project = get().currentProject;
    if (!project) {
      console.warn("No project to export");
      return;
    }

    const zip = new JSZip();
    
    // Add all files from all agents
    project.agents.forEach((agent) => {
      agent.files.forEach((file) => {
        zip.file(file.path, file.content);
      });
    });

    // Add project metadata
    zip.file('project.json', JSON.stringify(project, null, 2));

    // Add package.json
    zip.file('package.json', JSON.stringify({
      name: project.name.toLowerCase().replace(/\s+/g, '-'),
      version: "1.0.0",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.37",
        "@types/react-dom": "^18.2.15",
        "@vitejs/plugin-react": "^4.1.0",
        "typescript": "^5.2.2",
        "vite": "^4.5.0"
      }
    }, null, 2));

    zip.generateAsync({ type: "blob" }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      console.log("✅ Project exported as ZIP");
    });
  }
}));