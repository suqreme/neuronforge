export interface TaskStage {
  id: string;
  name: string;
  description: string;
  duration: number; // in milliseconds
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  assignedBy: string;
  type: 'ui' | 'backend' | 'llm' | 'sandbox' | 'deployment';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number; // 0-100
  stages: TaskStage[];
  currentStage?: string;
  files?: GeneratedFile[];
  metadata?: Record<string, any>;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
}

export interface GeneratedFile {
  id: string;
  name: string;
  path: string;
  type: 'component' | 'style' | 'util' | 'test' | 'config';
  size: string;
  status: 'generating' | 'completed' | 'error';
  language: string;
  lastModified: number;
}

export interface UITaskData {
  framework: string;
  styleSystem: string;
  components: string[];
  features: string[];
  livePreview: boolean;
  responsive: boolean;
}

export interface BackendTaskData {
  runtime: string;
  database: string;
  endpoints: string[];
  authentication: boolean;
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';
  port?: number;
}

// Task execution states
export interface TaskExecution {
  taskId: string;
  agentId: string;
  status: 'initializing' | 'analyzing' | 'executing' | 'testing' | 'completed' | 'error';
  currentStage: TaskStage | null;
  remainingStages: TaskStage[];
  completedStages: TaskStage[];
  logs: TaskLog[];
  error?: string;
}

export interface TaskLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

// Predefined task stages for different agent types
export const UI_TASK_STAGES: TaskStage[] = [
  {
    id: 'analyze',
    name: 'Analyzing Task',
    description: 'Understanding requirements and design patterns',
    duration: 1500,
    status: 'pending'
  },
  {
    id: 'scaffold',
    name: 'Scaffolding Components',
    description: 'Creating component structure and boilerplate',
    duration: 2000,
    status: 'pending'
  },
  {
    id: 'styling',
    name: 'Applying Styles',
    description: 'Implementing responsive design and theming',
    duration: 1800,
    status: 'pending'
  },
  {
    id: 'integration',
    name: 'Component Integration',
    description: 'Connecting components and state management',
    duration: 1200,
    status: 'pending'
  },
  {
    id: 'preview',
    name: 'Preparing Preview',
    description: 'Setting up live preview and hot reload',
    duration: 1000,
    status: 'pending'
  }
];

export const BACKEND_TASK_STAGES: TaskStage[] = [
  {
    id: 'analyze',
    name: 'Analyzing Requirements',
    description: 'Understanding API requirements and data flow',
    duration: 1200,
    status: 'pending'
  },
  {
    id: 'database',
    name: 'Database Design',
    description: 'Creating schema and data models',
    duration: 2200,
    status: 'pending'
  },
  {
    id: 'api',
    name: 'Building API',
    description: 'Implementing endpoints and business logic',
    duration: 2800,
    status: 'pending'
  },
  {
    id: 'auth',
    name: 'Authentication',
    description: 'Setting up security and access control',
    duration: 1500,
    status: 'pending'
  },
  {
    id: 'testing',
    name: 'Testing & Validation',
    description: 'Running tests and validating endpoints',
    duration: 1300,
    status: 'pending'
  }
];

// File generation templates
export const generateUIFiles = (taskData: any): GeneratedFile[] => {
  const { components = [], framework = 'React' } = taskData;
  const files: GeneratedFile[] = [];
  
  // Add main components
  components.forEach((component: string, index: number) => {
    files.push({
      id: `comp-${index}`,
      name: `${component}.tsx`,
      path: `src/components/${component}.tsx`,
      type: 'component',
      size: `${Math.floor(Math.random() * 3 + 1)}.${Math.floor(Math.random() * 9)}KB`,
      status: 'generating',
      language: 'typescript',
      lastModified: Date.now()
    });
  });

  // Add supporting files
  files.push(
    {
      id: 'types',
      name: 'types.ts',
      path: 'src/types/index.ts',
      type: 'util',
      size: '1.2KB',
      status: 'generating',
      language: 'typescript',
      lastModified: Date.now()
    },
    {
      id: 'styles',
      name: 'styles.css',
      path: 'src/styles/components.css',
      type: 'style',
      size: '2.1KB',
      status: 'generating',
      language: 'css',
      lastModified: Date.now()
    }
  );

  return files;
};

export const generateBackendFiles = (taskData: any): GeneratedFile[] => {
  const { endpoints = [], runtime = 'Node.js' } = taskData;
  const files: GeneratedFile[] = [];
  
  // Add route files
  endpoints.forEach((endpoint: string, index: number) => {
    const routeName = endpoint.split(' ')[1]?.split('/')[2] || `route${index}`;
    files.push({
      id: `route-${index}`,
      name: `${routeName}.js`,
      path: `src/routes/${routeName}.js`,
      type: 'component',
      size: `${Math.floor(Math.random() * 2 + 1)}.${Math.floor(Math.random() * 9)}KB`,
      status: 'generating',
      language: 'javascript',
      lastModified: Date.now()
    });
  });

  // Add supporting files
  files.push(
    {
      id: 'server',
      name: 'server.js',
      path: 'src/server.js',
      type: 'config',
      size: '1.8KB',
      status: 'generating',
      language: 'javascript',
      lastModified: Date.now()
    },
    {
      id: 'models',
      name: 'models.js',
      path: 'src/models/index.js',
      type: 'util',
      size: '2.3KB',
      status: 'generating',
      language: 'javascript',
      lastModified: Date.now()
    }
  );

  return files;
};

// Helper functions
export const createTaskExecution = (task: AgentTask, agentId: string): TaskExecution => ({
  taskId: task.id,
  agentId,
  status: 'initializing',
  currentStage: null,
  remainingStages: [...task.stages],
  completedStages: [],
  logs: []
});

export const getTaskStagesForType = (type: AgentTask['type']): TaskStage[] => {
  switch (type) {
    case 'ui':
      return UI_TASK_STAGES.map(stage => ({ ...stage, status: 'pending' as const }));
    case 'backend':
      return BACKEND_TASK_STAGES.map(stage => ({ ...stage, status: 'pending' as const }));
    default:
      return [];
  }
};

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

export const getFileTypeIcon = (type: GeneratedFile['type']): string => {
  const icons = {
    component: '⚛️',
    style: '🎨',
    util: '🔧',
    test: '🧪',
    config: '⚙️'
  };
  return icons[type] || '📄';
};

export const getStatusColor = (status: string): string => {
  const colors = {
    pending: 'text-gray-500',
    active: 'text-blue-600',
    'in_progress': 'text-blue-600',
    generating: 'text-blue-600',
    completed: 'text-green-600',
    error: 'text-red-600'
  };
  return colors[status as keyof typeof colors] || 'text-gray-500';
};