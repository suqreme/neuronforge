import { useLogStore } from '../stores/logStore';
import { useProjectStore } from '../stores/projectStore';
import { useEditorStore } from '../stores/editorStore';
import { EditorFile } from '../types';

interface AgentWorkStep {
  agent: string;
  message: string;
  delay: number;
  level: 'info' | 'success' | 'warn' | 'error';
  action?: () => void;
}

// Generate realistic file content based on prompt
const generateFileContent = (prompt: string, fileName: string): string => {
  const promptLower = prompt.toLowerCase();
  
  if (fileName.includes('App.tsx')) {
    if (promptLower.includes('todo') || promptLower.includes('task')) {
      return `import React, { useState } from 'react';
import TodoList from './components/TodoList';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
    };
    setTodos([...todos, newTodo]);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Todo App</h1>
        <TodoList todos={todos} onAddTodo={addTodo} />
      </div>
    </div>
  );
}

export default App;`;
    } else if (promptLower.includes('contact') || promptLower.includes('form')) {
      return `import React, { useState } from 'react';
import ContactForm from './components/ContactForm';
import './App.css';

function App() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (data: any) => {
    console.log('Form submitted:', data);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Contact Us
        </h1>
        {submitted ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            Thank you for your message!
          </div>
        ) : (
          <ContactForm onSubmit={handleSubmit} />
        )}
      </div>
    </div>
  );
}

export default App;`;
    }
  }
  
  // Default component
  return `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-gray-600">
          Your AI-generated application is ready!
        </p>
      </div>
    </div>
  );
}

export default App;`;
};

// Simulate agent workflow
export const processPrompt = async (prompt: string): Promise<void> => {
  const addLog = useLogStore.getState().addLog;
  const updateAgent = useProjectStore.getState().updateAgent;
  const openFile = useEditorStore.getState().openFile;

  // Define the workflow steps
  const workflowSteps: AgentWorkStep[] = [
    {
      agent: 'Manager',
      message: `Analyzing prompt: "${prompt}"`,
      delay: 500,
      level: 'info',
      action: () => updateAgent('manager-1', { status: 'running', progress: 20 })
    },
    {
      agent: 'Manager',
      message: 'Breaking down requirements and assigning tasks...',
      delay: 1000,
      level: 'info',
      action: () => updateAgent('manager-1', { status: 'running', progress: 40 })
    },
    {
      agent: 'Manager',
      message: 'Spawning UI and Backend agents',
      delay: 800,
      level: 'success',
      action: () => {
        updateAgent('manager-1', { status: 'completed', progress: 100 });
        updateAgent('ui-1', { status: 'running', progress: 10 });
      }
    },
    {
      agent: 'UI Agent',
      message: 'Starting component layout design...',
      delay: 1200,
      level: 'info',
      action: () => updateAgent('ui-1', { status: 'running', progress: 30 })
    },
    {
      agent: 'UI Agent',
      message: 'Generating React components with TypeScript',
      delay: 1500,
      level: 'info',
      action: () => updateAgent('ui-1', { status: 'running', progress: 60 })
    },
    {
      agent: 'Backend',
      message: 'Preparing API stubs and data structures...',
      delay: 1000,
      level: 'info',
      action: () => updateAgent('backend-1', { status: 'running', progress: 25 })
    },
    {
      agent: 'UI Agent',
      message: 'Applying Tailwind CSS styling',
      delay: 1000,
      level: 'info',
      action: () => updateAgent('ui-1', { status: 'running', progress: 80 })
    },
    {
      agent: 'Backend',
      message: 'Setting up Express routes and middleware',
      delay: 1200,
      level: 'info',
      action: () => updateAgent('backend-1', { status: 'running', progress: 60 })
    },
    {
      agent: 'UI Agent',
      message: 'Generated App.tsx with responsive design',
      delay: 800,
      level: 'success',
      action: () => {
        updateAgent('ui-1', { status: 'completed', progress: 100 });
        
        // Generate and inject the file
        const newFile: EditorFile = {
          path: 'src/App.tsx',
          content: generateFileContent(prompt, 'App.tsx'),
          language: 'typescript',
          isDirty: false,
        };
        openFile(newFile);
      }
    },
    {
      agent: 'Backend',
      message: 'API endpoints ready for integration',
      delay: 600,
      level: 'success',
      action: () => updateAgent('backend-1', { status: 'completed', progress: 100 })
    },
    {
      agent: 'System',
      message: 'Build complete! Your app is ready for preview.',
      delay: 500,
      level: 'success',
      action: () => {
        useProjectStore.getState().updateProjectStatus('running');
      }
    },
  ];

  // Execute workflow steps sequentially
  for (const step of workflowSteps) {
    await new Promise(resolve => setTimeout(resolve, step.delay));
    
    addLog({
      level: step.level,
      source: step.agent,
      message: step.message,
      agentId: step.agent.toLowerCase().replace(' ', '-')
    });

    // Execute any associated action
    if (step.action) {
      step.action();
    }
  }
};

// Utility to simulate file streaming (for future use)
export const simulateFileStreaming = async (filePath: string, content: string): Promise<void> => {
  const openFile = useEditorStore.getState().openFile;
  const updateContent = useEditorStore.getState().updateContent;
  
  // Open empty file first
  openFile({
    path: filePath,
    content: '',
    language: 'typescript',
    isDirty: false,
  });

  // Stream content in chunks
  const chunks = content.match(/.{1,50}/g) || [content];
  let currentContent = '';
  
  for (const chunk of chunks) {
    await new Promise(resolve => setTimeout(resolve, 100));
    currentContent += chunk;
    updateContent(filePath, currentContent);
  }
};

// Quick agent responses for different prompt types
export const getAgentPlan = (prompt: string): string => {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('todo') || promptLower.includes('task')) {
    return 'I\'ll create a todo list app with add/remove functionality, state management, and a clean interface.';
  } else if (promptLower.includes('contact') || promptLower.includes('form')) {
    return 'I\'ll build a contact form with validation, responsive design, and form submission handling.';
  } else if (promptLower.includes('dashboard')) {
    return 'I\'ll create a dashboard with charts, data tables, and real-time updates.';
  } else if (promptLower.includes('blog') || promptLower.includes('post')) {
    return 'I\'ll build a blog interface with post listings, search, and content management.';
  } else {
    return 'I\'ll analyze your requirements and create a custom React application with modern patterns.';
  }
};