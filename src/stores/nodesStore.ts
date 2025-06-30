import { create } from 'zustand';
import { Node, Edge, Connection } from '@xyflow/react';
import { AgentNode, AgentNodeType, createSampleNode } from '../types/nodes';
import { TaskMessage, createTaskAssignment } from '../types/messages';

interface NodesState {
  nodes: Node[];
  edges: Edge[];
  managerId: string | null;
  sandboxId: string | null;
  messages: TaskMessage[];
  messageListeners: Record<string, ((message: TaskMessage) => void)[]>;
  pendingFileUpdates: Array<{fromAgentId: string, filePath: string, fileContent: string}>; // Buffer for file updates before sandbox is ready
  
  // Actions
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  
  // Manager-specific actions
  setManager: (managerId: string) => void;
  setSandbox: (sandboxId: string) => void;
  spawnAgentFromManager: (agentType: AgentNodeType, taskData: any, position?: { x: number; y: number }) => string;
  updateNodeData: (id: string, data: Partial<any>) => void;
  processPrompt: (prompt: string) => void;
  clearCanvas: () => void;
  
  // Message bus actions
  sendMessage: (message: TaskMessage) => void;
  subscribeToMessages: (agentId: string, callback: (message: TaskMessage) => void) => () => void;
  sendFileUpdate: (fromAgentId: string, filePath: string, fileContent: string) => void;
  resetProject: () => void;
}

// Smart prompt parsing logic
const parsePrompt = (prompt: string) => {
  const lowercasePrompt = prompt.toLowerCase();
  
  // Check for explicit "no backend" or HTML-only requests
  const isHtmlOnly = lowercasePrompt.includes('html') && (
    lowercasePrompt.includes('no backend') ||
    lowercasePrompt.includes('static') ||
    lowercasePrompt.includes('simple') ||
    lowercasePrompt.includes('one page') ||
    lowercasePrompt.includes('landing page') ||
    lowercasePrompt.includes('profile') ||
    lowercasePrompt.includes('portfolio')
  );
  
  // Check for explicit backend requirements
  const needsBackend = lowercasePrompt.includes('api') ||
    lowercasePrompt.includes('database') ||
    lowercasePrompt.includes('server') ||
    lowercasePrompt.includes('auth') ||
    lowercasePrompt.includes('login') ||
    lowercasePrompt.includes('save') ||
    lowercasePrompt.includes('store');
  
  // Define patterns and their associated tasks
  const patterns = [
    {
      keywords: ['profile', 'portfolio', 'resume', 'cv'],
      appType: 'Profile Website',
      tasks: [
        { 
          type: 'ui', 
          description: 'Build personal profile website with HTML/CSS', 
          components: ['Profile', 'Skills', 'Projects', 'Contact'],
          framework: 'HTML'
        }
      ]
    },
    {
      keywords: ['landing', 'marketing', 'business'],
      appType: 'Landing Page',
      tasks: [
        { 
          type: 'ui', 
          description: 'Create marketing landing page with HTML/CSS', 
          components: ['Hero', 'Features', 'CTA', 'Footer'],
          framework: 'HTML'
        }
      ]
    },
    {
      keywords: ['chat', 'messaging', 'conversation'],
      appType: 'Chat Application',
      tasks: [
        { type: 'ui', description: 'Build chat interface with message bubbles and input', components: ['ChatWindow', 'MessageList', 'MessageInput', 'UserList'] },
        { type: 'backend', description: 'Create real-time messaging API with WebSocket', endpoints: ['POST /api/messages', 'GET /api/conversations', 'WebSocket /chat'] }
      ]
    },
    {
      keywords: ['notes', 'note', 'notebook', 'journal'],
      appType: 'Notes Application',
      tasks: [
        { type: 'ui', description: 'Create note editor with rich text and organization', components: ['NoteEditor', 'NotesList', 'Sidebar', 'SearchBar'] },
        { type: 'backend', description: 'Build note storage and sync API', endpoints: ['GET /api/notes', 'POST /api/notes', 'PUT /api/notes/:id', 'DELETE /api/notes/:id'] }
      ]
    },
    {
      keywords: ['todo', 'task', 'productivity', 'reminder'],
      appType: 'Task Management',
      tasks: [
        { type: 'ui', description: 'Build task interface with drag-and-drop', components: ['TaskList', 'TaskCard', 'AddTaskForm', 'FilterBar'] },
        { type: 'backend', description: 'Create task management API with categories', endpoints: ['GET /api/tasks', 'POST /api/tasks', 'PUT /api/tasks/:id', 'DELETE /api/tasks/:id'] }
      ]
    },
    {
      keywords: ['ecommerce', 'shop', 'store', 'product'],
      appType: 'E-commerce Platform',
      tasks: [
        { type: 'ui', description: 'Build product catalog and shopping cart', components: ['ProductGrid', 'ProductCard', 'ShoppingCart', 'Checkout'] },
        { type: 'backend', description: 'Create product and order management API', endpoints: ['GET /api/products', 'POST /api/orders', 'GET /api/cart', 'POST /api/payment'] }
      ]
    },
    {
      keywords: ['dashboard', 'analytics', 'data', 'metrics'],
      appType: 'Analytics Dashboard',
      tasks: [
        { type: 'ui', description: 'Build interactive charts and data visualization', components: ['ChartContainer', 'MetricCard', 'FilterPanel', 'DataTable'] },
        { type: 'backend', description: 'Create data aggregation and analytics API', endpoints: ['GET /api/metrics', 'GET /api/analytics', 'POST /api/reports'] }
      ]
    }
  ];

  // Find matching pattern
  const matchedPattern = patterns.find(pattern => 
    pattern.keywords.some(keyword => lowercasePrompt.includes(keyword))
  );

  if (matchedPattern) {
    let tasks = [...matchedPattern.tasks];
    
    // Remove backend if explicitly no backend or HTML-only
    if (isHtmlOnly || lowercasePrompt.includes('no backend')) {
      tasks = tasks.filter(task => task.type !== 'backend');
    }
    
    return {
      appType: matchedPattern.appType,
      tasks: tasks,
      strategy: `Building ${matchedPattern.appType} with ${tasks.length} core agent${tasks.length > 1 ? 's' : ''}`
    };
  }

  // Smart fallback based on prompt analysis
  let tasks = [];
  
  // Always add UI task
  if (isHtmlOnly) {
    tasks.push({ 
      type: 'ui', 
      description: 'Create HTML website with CSS styling', 
      components: ['Main', 'Header', 'Content', 'Footer'],
      framework: 'HTML'
    });
  } else {
    tasks.push({ 
      type: 'ui', 
      description: 'Build user interface components', 
      components: ['App', 'Layout', 'Components'],
      framework: 'React'
    });
  }
  
  // Only add backend if needed and not explicitly excluded
  if (needsBackend && !isHtmlOnly && !lowercasePrompt.includes('no backend')) {
    tasks.push({ 
      type: 'backend', 
      description: 'Create backend API and services', 
      endpoints: ['GET /api/data', 'POST /api/create'] 
    });
  }

  return {
    appType: isHtmlOnly ? 'HTML Website' : 'Custom Application',
    tasks: tasks,
    strategy: `Building ${isHtmlOnly ? 'static HTML website' : 'application'} with ${tasks.length} agent${tasks.length > 1 ? 's' : ''}`
  };
};

export const useNodesStore = create<NodesState>((set, get) => ({
  nodes: [],
  edges: [],
  managerId: null,
  sandboxId: null,
  messages: [],
  messageListeners: {},
  pendingFileUpdates: [],

  addNode: (node: Node) => {
    set(state => ({
      nodes: [...state.nodes, node]
    }));
  },

  updateNode: (id: string, updates: Partial<Node>) => {
    set(state => ({
      nodes: state.nodes.map(node => 
        node.id === id ? { ...node, ...updates } : node
      )
    }));
  },

  removeNode: (id: string) => {
    set(state => ({
      nodes: state.nodes.filter(node => node.id !== id),
      edges: state.edges.filter(edge => edge.source !== id && edge.target !== id)
    }));
  },

  addEdge: (edge: Edge) => {
    set(state => ({
      edges: [...state.edges, edge]
    }));
  },

  removeEdge: (id: string) => {
    set(state => ({
      edges: state.edges.filter(edge => edge.id !== id)
    }));
  },

  setNodes: (nodes: Node[]) => {
    set({ nodes });
  },

  setEdges: (edges: Edge[]) => {
    set({ edges });
  },

  updateNodeData: (id: string, data: Partial<any>) => {
    set(state => ({
      nodes: state.nodes.map(node => 
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      )
    }));
  },

  setManager: (managerId: string) => {
    set({ managerId });
  },

  setSandbox: (sandboxId: string) => {
    console.log(`🏗️ Registering sandbox agent: ${sandboxId}`);
    console.log(`🏗️ Current state before registration:`, {
      currentSandboxId: get().sandboxId,
      pendingUpdates: get().pendingFileUpdates.length,
      totalNodes: get().nodes.length,
      nodeTypes: get().nodes.map(n => n.type)
    });
    
    const { pendingFileUpdates } = get();
    
    set({ sandboxId });
    
    // Replay any pending file updates that were sent before sandbox was ready
    if (pendingFileUpdates.length > 0) {
      console.log(`🔄 Replaying ${pendingFileUpdates.length} pending file updates to newly registered sandbox`);
      
      // Send each pending file update
      pendingFileUpdates.forEach(({ fromAgentId, filePath, fileContent }) => {
        console.log(`📁 Replaying file: ${filePath} from ${fromAgentId} (${fileContent.length} chars)`);
        get().sendFileUpdate(fromAgentId, filePath, fileContent);
      });
      
      // Clear pending updates
      set({ pendingFileUpdates: [] });
    } else {
      console.log(`✅ No pending file updates to replay`);
    }
    
    console.log(`✅ Sandbox registration complete: ${sandboxId}`);
  },

  spawnAgentFromManager: (agentType: AgentNodeType, taskData: any, position = { x: 0, y: 0 }) => {
    const { nodes, managerId } = get();
    const agentId = `${agentType}-${Date.now()}`;
    
    // Calculate position relative to manager or use provided position
    let spawnPosition = position;
    if (managerId && position.x === 0 && position.y === 0) {
      const manager = nodes.find(n => n.id === managerId);
      if (manager) {
        const agentCount = nodes.filter(n => n.type === agentType).length;
        spawnPosition = {
          x: manager.position.x + 350 + (agentCount * 50),
          y: manager.position.y + (agentCount * 150)
        };
      }
    }

    // Create new agent node
    const newAgent = createSampleNode(agentId, agentType, spawnPosition, {
      status: 'working',
      description: taskData.description,
      progress: 0,
      ...taskData
    });

    // Add the node
    get().addNode(newAgent);

    // Connect to manager if exists
    if (managerId) {
      const edgeId = `${managerId}-to-${agentId}`;
      const newEdge: Edge = {
        id: edgeId,
        source: managerId,
        target: agentId,
        type: 'smoothstep',
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        data: { messageType: 'task_assignment', messageCount: 1 }
      };
      
      get().addEdge(newEdge);
      
      console.log(`✅ Manager assigned task to ${agentType} agent:`, taskData.description);
      
      // Log sandbox creation for debugging
      if (agentType === 'sandbox') {
        console.log(`🏗️ Sandbox node spawned with ID: ${agentId}`);
        console.log(`🏗️ Sandbox will self-register when component mounts`);
      }
    }

    return agentId;
  },

  processPrompt: (prompt: string) => {
    const { managerId, clearCanvas } = get();
    
    console.log('🧠 Manager processing prompt:', prompt);
    
    // Reset sandbox state for new project
    import('../stores/sandboxStore').then(({ useSandboxStore }) => {
      useSandboxStore.getState().resetSandbox();
    });
    
    // Clear existing nodes except manager
    const currentNodes = get().nodes;
    const managerNode = currentNodes.find(n => n.id === managerId);
    if (managerNode) {
      set({ 
        nodes: [managerNode], 
        edges: [] 
      });
    } else {
      clearCanvas();
      
      // Create new manager if none exists
      const newManagerId = `manager-${Date.now()}`;
      const manager = createSampleNode(newManagerId, 'manager', { x: 100, y: 200 }, {
        status: 'working',
        description: 'Analyzing prompt and planning tasks',
        progress: 0
      });
      
      get().addNode(manager);
      get().setManager(newManagerId);
    }

    // Parse the prompt
    const parsed = parsePrompt(prompt);
    console.log('📋 Task breakdown:', parsed);

    // Update manager with strategy
    if (managerId || get().managerId) {
      const currentManagerId = managerId || get().managerId!;
      get().updateNode(currentManagerId, {
        data: {
          ...get().nodes.find(n => n.id === currentManagerId)?.data,
          strategy: parsed.strategy,
          totalTasks: parsed.tasks.length,
          completedTasks: 0,
          activeAgents: parsed.tasks.length,
          description: `Building ${parsed.appType}`
        }
      });
    }

    // Spawn agents for each task with slight delay for visual effect
    const spawnedAgentIds: string[] = [];
    
    parsed.tasks.forEach((task, index) => {
      setTimeout(() => {
        const agentId = get().spawnAgentFromManager(task.type as AgentNodeType, task);
        spawnedAgentIds.push(agentId);
      }, index * 500);
    });

    // Spawn sandbox after agents with connections
    setTimeout(() => {
      console.log(`🚀 Spawning sandbox node...`);
      const sandboxId = get().spawnAgentFromManager('sandbox', {
        title: 'Live Preview',
        description: 'Live preview environment for the application',
        autoStart: true
      });
      
      console.log(`📦 Sandbox spawned with ID: ${sandboxId}`);
      
      // Connect all UI/Backend agents to sandbox
      setTimeout(() => {
        console.log(`🔗 Attempting to connect agents to sandbox...`);
        const currentNodes = get().nodes;
        const agentNodes = currentNodes.filter(n => 
          n.type === 'ui' || n.type === 'backend'
        );
        
        console.log(`🔍 Found ${agentNodes.length} agent nodes to connect:`, agentNodes.map(n => `${n.type}:${n.id}`));
        console.log(`🔍 Target sandbox ID: ${sandboxId}`);
        
        agentNodes.forEach(agent => {
          const edgeId = `${agent.id}-to-${sandboxId}`;
          const newEdge: Edge = {
            id: edgeId,
            source: agent.id,
            target: sandboxId,
            targetHandle: 'files-input',
            type: 'smoothstep',
            style: { stroke: '#10b981', strokeWidth: 2 },
            animated: true,
            data: { messageType: 'file_transfer', messageCount: 0 }
          };
          
          get().addEdge(newEdge);
          console.log(`🔗 Created edge: ${agent.type} agent (${agent.id}) → sandbox (${sandboxId})`);
        });
        
        console.log(`✅ Connected ${agentNodes.length} agents to sandbox`);
        console.log(`📊 Total edges now: ${get().edges.length}`);
      }, 500);
      
    }, parsed.tasks.length * 500 + 200);

    // Update manager progress
    setTimeout(() => {
      const currentManagerId = get().managerId!;
      get().updateNode(currentManagerId, {
        data: {
          ...get().nodes.find(n => n.id === currentManagerId)?.data,
          status: 'completed',
          progress: 100,
          description: `Successfully planned ${parsed.appType}`
        }
      });
    }, parsed.tasks.length * 500 + 1000);
  },

  clearCanvas: () => {
    set({ 
      nodes: [], 
      edges: [], 
      managerId: null,
      sandboxId: null,
      messages: [],
      messageListeners: {},
      pendingFileUpdates: []
    });
  },

  // Message bus implementation
  sendMessage: (message: TaskMessage) => {
    const { messageListeners } = get();
    
    // Add to message history
    set(state => ({
      messages: [...state.messages, message]
    }));
    
    // Notify listeners for the target agent
    const targetListeners = messageListeners[message.to] || [];
    targetListeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error(`Error in message listener for ${message.to}:`, error);
      }
    });
    
    // Also notify 'all' listeners
    const allListeners = messageListeners['all'] || [];
    allListeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error(`Error in 'all' message listener:`, error);
      }
    });
    
    console.log(`📨 Message sent from ${message.from} to ${message.to}:`, message.type);
  },

  subscribeToMessages: (agentId: string, callback: (message: TaskMessage) => void) => {
    const { messageListeners } = get();
    
    // Add callback to listeners
    const currentListeners = messageListeners[agentId] || [];
    const newListeners = [...currentListeners, callback];
    
    set(state => ({
      messageListeners: {
        ...state.messageListeners,
        [agentId]: newListeners
      }
    }));
    
    // Return unsubscribe function
    return () => {
      const { messageListeners: currentListeners } = get();
      const agentListeners = currentListeners[agentId] || [];
      const filteredListeners = agentListeners.filter(cb => cb !== callback);
      
      set(state => ({
        messageListeners: {
          ...state.messageListeners,
          [agentId]: filteredListeners
        }
      }));
    };
  },

  sendFileUpdate: (fromAgentId: string, filePath: string, fileContent: string) => {
    const { sandboxId, edges, pendingFileUpdates } = get();
    
    if (!sandboxId) {
      console.log(`📦 Sandbox not ready yet, buffering file update: ${filePath} from ${fromAgentId}`);
      
      // Add to pending updates buffer
      const newPendingUpdate = { fromAgentId, filePath, fileContent };
      set({ 
        pendingFileUpdates: [...pendingFileUpdates, newPendingUpdate] 
      });
      
      console.log(`📦 Total pending file updates: ${pendingFileUpdates.length + 1}`);
      return;
    }
    
    // Animate the edge to show file transfer
    const edgeId = `${fromAgentId}-to-${sandboxId}`;
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      // Temporarily highlight the edge
      const updatedEdges = edges.map(e => 
        e.id === edgeId 
          ? { 
              ...e, 
              style: { ...e.style, stroke: '#f59e0b', strokeWidth: 3 },
              animated: true,
              data: { ...e.data, messageCount: ((e.data?.messageCount as number) || 0) + 1 }
            }
          : e
      );
      
      set({ edges: updatedEdges });
      
      // Reset edge after animation
      setTimeout(() => {
        const resetEdges = get().edges.map(e => 
          e.id === edgeId 
            ? { 
                ...e, 
                style: { stroke: '#10b981', strokeWidth: 2 },
                animated: false 
              }
            : e
        );
        set({ edges: resetEdges });
      }, 1000);
    }
    
    // Normalize file path - remove leading slash for WebContainer compatibility
    const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    
    const message: TaskMessage = {
      id: `file-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'task_assignment', // Using existing type, could be 'file_update'
      from: fromAgentId,
      to: sandboxId,
      timestamp: Date.now(),
      payload: {
        description: `File update: ${normalizedPath}`,
        priority: 'medium',
        status: 'pending',
        data: {
          type: 'file_update',
          filePath: normalizedPath,
          fileContent
        }
      }
    };
    
    console.log(`📤 Sending file update message:`, message);
    get().sendMessage(message);
    console.log(`📁 File update sent from ${fromAgentId} to sandbox: ${normalizedPath}`);
  },

  resetProject: () => {
    // Clear all nodes, edges, and messages
    set({
      nodes: [],
      edges: [],
      managerId: null,
      sandboxId: null,
      messages: [],
      messageListeners: {},
      pendingFileUpdates: []
    });
    
    console.log('🧹 Project state reset - ready for new project');
  }
}));