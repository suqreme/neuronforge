import { useLogStore } from '../stores/logStore';
import { useProjectStore } from '../stores/projectStore';
import { useEditorStore } from '../stores/editorStore';
import { useAgentStore } from '../stores/agentStore';
// Note: callClaude now available through claudeApi
import { hasValidApiKey } from './env';
import { writeAgentFile, writeAgentFiles } from './fileWriter';
import { extractCodeFromMarkdown, extractMultipleFiles } from './codeExtractor';
import { promptAgent, type GeneratedFile } from '../agents/promptAgent';
import { callClaudeWithContext, type LLMProvider } from './claudeApi';
import { getCurrentProvider } from './providerManager';
import { EditorFile } from '../types';

// Fallback templates when Claude API fails
const fallbackTemplates = {
  todoApp: `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');

  const addTodo = () => {
    if (inputText.trim()) {
      const newTodo = {
        id: Date.now(),
        text: inputText,
        completed: false,
      };
      setTodos([...todos, newTodo]);
      setInputText('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Todo App</h1>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add a new todo..."
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {todos.map(todo => (
          <li
            key={todo.id}
            className={\`flex items-center p-2 rounded cursor-pointer \${
              todo.completed ? 'bg-green-100 text-green-800' : 'bg-gray-100'
            }\`}
            onClick={() => toggleTodo(todo.id)}
          >
            <span className={\`flex-1 \${todo.completed ? 'line-through' : ''}\`}>
              {todo.text}
            </span>
            {todo.completed && <span className="text-green-600">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;`,

  contactForm: `import React, { useState } from 'react';

function App() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-green-100 rounded-lg">
        <h2 className="text-xl font-bold text-green-800 mb-2">Thank you!</h2>
        <p className="text-green-700">Your message has been sent successfully.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Contact Us</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Send Message
        </button>
      </form>
    </div>
  );
}

export default App;`
};

// Get fallback template based on prompt
const getFallbackTemplate = (prompt: string): string => {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('todo') || promptLower.includes('task')) {
    return fallbackTemplates.todoApp;
  } else if (promptLower.includes('contact') || promptLower.includes('form')) {
    return fallbackTemplates.contactForm;
  } else {
    return fallbackTemplates.todoApp; // Default fallback
  }
};

interface AgentWorkStep {
  agent: string;
  delay: number;
  level: 'info' | 'success' | 'warn' | 'error';
  action: () => Promise<void>;
}

// Process LLM-generated files from the new prompt agent system
const processLLMGeneratedFiles = async (files: GeneratedFile[], agentType: string): Promise<void> => {
  try {
    if (files.length === 0) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: agentType,
        message: 'No files generated by LLM'
      });
      return;
    }

    useLogStore.getState().addLog({
      level: 'info',
      source: agentType,
      message: `Generated ${files.length} files with LLM`
    });

    // Process each generated file
    for (const file of files) {
      await writeAgentFile(file.filename, file.content, file.language || 'typescript');
      useLogStore.getState().addLog({
        level: 'success',
        source: agentType,
        message: `Created file: ${file.filename}`
      });
    }

  } catch (error) {
    useLogStore.getState().addLog({
      level: 'error',
      source: agentType,
      message: `Failed to process LLM files: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

// Legacy function for backward compatibility
const processAIResponse = async (aiResponse: string, agentType: string): Promise<void> => {
  try {
    // Try to extract multiple files first
    const extractedFiles = extractMultipleFiles(aiResponse);
    
    if (extractedFiles.length > 1) {
      // Multiple files detected
      useLogStore.getState().addLog({
        level: 'info',
        source: agentType,
        message: `Extracted ${extractedFiles.length} files from AI response`
      });
      
      await writeAgentFiles(extractedFiles);
    } else if (extractedFiles.length === 1) {
      // Single file detected
      const file = extractedFiles[0];
      await writeAgentFile(file.path, file.content, file.language);
    } else {
      // No clear file structure, try basic code extraction
      const code = extractCodeFromMarkdown(aiResponse);
      if (code) {
        await writeAgentFile('src/App.tsx', code, 'typescript');
      } else {
        useLogStore.getState().addLog({
          level: 'warn',
          source: agentType,
          message: 'No extractable code found in AI response'
        });
      }
    }
  } catch (error) {
    useLogStore.getState().addLog({
      level: 'error',
      source: agentType,
      message: `Failed to process AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

// Real AI-powered agent workflow
export const processPromptWithAI = async (prompt: string): Promise<void> => {
  const addLog = useLogStore.getState().addLog;
  const updateAgent = useProjectStore.getState().updateAgent;
  const openFile = useEditorStore.getState().openFile;
  const { setThoughts, appendLog, updateMemory, sendMessage } = useAgentStore.getState();

  // Check if API key is configured
  if (!hasValidApiKey()) {
    addLog({
      level: 'error',
      source: 'System',
      message: 'No API key configured. Please set VITE_CLAUDE_API_KEY in your .env file.'
    });
    return;
  }

  try {
    // Update project status
    useProjectStore.getState().updateProjectStatus('building');

    const workflowSteps: AgentWorkStep[] = [
      {
        agent: 'Manager',
        delay: 500,
        level: 'info',
        action: async () => {
          updateAgent('manager-1', { status: 'running', progress: 20 });
          setThoughts('manager-agent', `🔍 Analyzing user prompt: "${prompt.slice(0, 50)}..."`);
          updateMemory('manager-agent', 'currentPrompt', prompt);
          appendLog('manager-agent', 'Starting prompt analysis');
          addLog({
            level: 'info',
            source: 'Manager',
            message: `Analyzing prompt: "${prompt}"`
          });
        }
      },
      {
        agent: 'Manager',
        delay: 1000,
        level: 'info',
        action: async () => {
          updateAgent('manager-1', { status: 'running', progress: 50 });
          setThoughts('manager-agent', '🤖 Requesting project plan from Claude AI...');
          appendLog('manager-agent', 'Contacting Claude API for project planning');
          
          addLog({
            level: 'info',
            source: 'Manager',
            message: 'Requesting project plan from Claude'
          });
          
          try {
            // Use the new LLM system for project planning
            const provider: LLMProvider = getCurrentProvider();
            
            const planResponse = await callClaudeWithContext({
              prompt: `Analyze this development request and create a detailed project plan: "${prompt}"`,
              system: 'You are an expert project manager for web development. Create comprehensive development plans with clear task breakdowns.',
              temperature: 0.3
            });
            
            setThoughts('manager-agent', '✅ Received plan from LLM. Breaking down into tasks...');
            updateMemory('manager-agent', 'projectPlan', planResponse.slice(0, 200) + '...');
            updateMemory('manager-agent', 'llmProvider', provider);
            updateMemory('manager-agent', 'planningComplete', true);
            appendLog('manager-agent', `${provider.toUpperCase()} API response received successfully`);
            
            // Send plan to UI agent
            sendMessage({
              from: 'manager-agent',
              to: 'ui-agent',
              type: 'status_update',
              payload: { plan: planResponse }
            });
            
            addLog({
              level: 'success',
              source: 'Manager',
              message: `${provider.toUpperCase()} response received — plan generated`
            });
            
            addLog({
              level: 'info',
              source: 'Manager',
              message: planResponse
            });
          } catch (err) {
            console.error("LLM failed:", err);
            setThoughts('manager-agent', '⚠️ LLM API failed. Using fallback planning...');
            appendLog('manager-agent', 'LLM API failed - switching to fallback mode');
            updateMemory('manager-agent', 'fallbackMode', true);
            
            addLog({
              level: 'error',
              source: 'Manager',
              message: `LLM API failed: ${err instanceof Error ? err.message : 'Unknown error'}. Using fallback planning.`
            });
            
            addLog({
              level: 'info',
              source: 'Manager',
              message: `I'll create a ${prompt.toLowerCase().includes('todo') ? 'todo app' : 'web application'} with React, TypeScript, and Tailwind CSS.`
            });
          }
          
          setThoughts('manager-agent', '📋 Plan complete. Delegating to UI Agent...');
          updateAgent('manager-1', { status: 'completed', progress: 100 });
          updateAgent('ui-1', { status: 'running', progress: 10 });
        }
      },
      {
        agent: 'UI Agent',
        delay: 2000,
        level: 'info',
        action: async () => {
          updateAgent('ui-1', { status: 'running', progress: 30 });
          setThoughts('ui-agent', '🎨 Received task from Manager. Preparing component generation...');
          appendLog('ui-agent', 'Task received from Manager Agent');
          updateMemory('ui-agent', 'currentTask', 'Component Generation');
          addLog({
            level: 'info',
            source: 'UI Agent',
            message: 'Generating React component with AI...'
          });
        }
      },
      {
        agent: 'UI Agent',
        delay: 3000,
        level: 'info',
        action: async () => {
          updateAgent('ui-1', { status: 'running', progress: 70 });
          setThoughts('ui-agent', '🤖 Contacting Claude for React component generation...');
          appendLog('ui-agent', 'Starting Claude API call for component generation');
          
          addLog({
            level: 'info',
            source: 'UI Agent',
            message: 'Requesting component generation from Claude'
          });
          
          try {
            // Use the new prompt agent system for UI generation
            setThoughts('ui-agent', '🎨 Using advanced LLM to generate React components...');
            appendLog('ui-agent', 'Starting LLM-powered component generation');
            
            const provider: LLMProvider = getCurrentProvider();
            
            const generatedFiles = await promptAgent({
              agentType: 'ui',
              task: `Create a React TypeScript component for: "${prompt}". Use Tailwind CSS for styling. Include proper TypeScript interfaces and make it functional.`,
              provider,
              context: {
                projectName: useProjectStore.getState().project?.name
              }
            });
            
            setThoughts('ui-agent', '📄 Processing LLM response and creating files...');
            updateMemory('ui-agent', 'lastGeneratedComponent', prompt);
            updateMemory('ui-agent', 'llmProvider', provider);
            updateMemory('ui-agent', 'filesGenerated', generatedFiles.length);
            appendLog('ui-agent', `LLM generated ${generatedFiles.length} files successfully`);
            
            // Send completion status to manager
            sendMessage({
              from: 'ui-agent',
              to: 'manager-agent',
              type: 'file_update',
              payload: { 
                status: 'component_generated',
                files: generatedFiles.map(f => f.filename)
              }
            });
            
            addLog({
              level: 'success',
              source: 'UI Agent',
              message: `LLM generated ${generatedFiles.length} component files`
            });
            
            // Process the LLM-generated files
            await processLLMGeneratedFiles(generatedFiles, 'UI Agent');
            
          } catch (err) {
            console.error("LLM generation failed:", err);
            setThoughts('ui-agent', '⚠️ LLM failed. Using fallback template...');
            appendLog('ui-agent', 'LLM generation failed - using fallback template');
            updateMemory('ui-agent', 'fallbackUsed', true);
            
            addLog({
              level: 'error',
              source: 'UI Agent',
              message: `LLM failed: ${err instanceof Error ? err.message : 'Unknown error'} — fallback template used`
            });
            
            // Use fallback template
            const fallbackCode = getFallbackTemplate(prompt);
            await writeAgentFile('src/App.tsx', fallbackCode, 'typescript');
          }
          
          setThoughts('ui-agent', '✅ Component generation complete. Notifying Backend Agent...');
          updateAgent('ui-1', { status: 'completed', progress: 100 });
          updateAgent('backend-1', { status: 'running', progress: 20 });
        }
      },
      {
        agent: 'Backend',
        delay: 2000,
        level: 'info',
        action: async () => {
          updateAgent('backend-1', { status: 'running', progress: 60 });
          setThoughts('backend-agent', '⚙️ Received notification from UI Agent. Starting backend planning...');
          appendLog('backend-agent', 'Backend agent activated - starting API design');
          updateMemory('backend-agent', 'activatedBy', 'UI Agent completion');
          
          addLog({
            level: 'info',
            source: 'Backend',
            message: 'Requesting backend structure from Claude'
          });
          
          try {
            // Use the new prompt agent system for backend generation
            setThoughts('backend-agent', '⚙️ Using advanced LLM to generate backend APIs...');
            appendLog('backend-agent', 'Starting LLM-powered API generation');
            
            const provider: LLMProvider = getCurrentProvider();
            
            const generatedFiles = await promptAgent({
              agentType: 'backend',
              task: `Create backend API structure for: "${prompt}". Include Node.js/Express routes, middleware, and data models. Generate actual working code.`,
              provider,
              context: {
                projectName: useProjectStore.getState().project?.name
              }
            });
            
            setThoughts('backend-agent', '📊 Processing LLM response for API structure...');
            updateMemory('backend-agent', 'llmProvider', provider);
            updateMemory('backend-agent', 'framework', 'Express.js');
            updateMemory('backend-agent', 'filesGenerated', generatedFiles.length);
            appendLog('backend-agent', `LLM generated ${generatedFiles.length} backend files successfully`);
            
            // Notify manager of completion
            sendMessage({
              from: 'backend-agent',
              to: 'manager-agent',
              type: 'file_update',
              payload: { 
                status: 'backend_generated',
                files: generatedFiles.map(f => f.filename)
              }
            });
            
            addLog({
              level: 'success',
              source: 'Backend',
              message: `LLM generated ${generatedFiles.length} backend files`
            });
            
            // Process the LLM-generated files
            await processLLMGeneratedFiles(generatedFiles, 'Backend');
            
          } catch (err) {
            console.error("LLM generation failed:", err);
            setThoughts('backend-agent', '⚠️ LLM failed. Using standard backend patterns...');
            appendLog('backend-agent', 'LLM generation failed - using fallback backend planning');
            updateMemory('backend-agent', 'fallbackMode', true);
            
            addLog({
              level: 'error',
              source: 'Backend',
              message: `LLM failed: ${err instanceof Error ? err.message : 'Unknown error'} — using fallback`
            });
            
            addLog({
              level: 'info',
              source: 'Backend',
              message: `Backend will use standard REST API structure with Express.js for the ${prompt.toLowerCase().includes('todo') ? 'todo app' : 'application'}.`
            });
          }
          
          setThoughts('backend-agent', '✅ Backend planning complete. Ready for deployment...');
          updateAgent('backend-1', { status: 'completed', progress: 100 });
        }
      },
      {
        agent: 'System',
        delay: 500,
        level: 'success',
        action: async () => {
          useProjectStore.getState().updateProjectStatus('running');
          addLog({
            level: 'success',
            source: 'System',
            message: 'AI-powered build complete! Your app is ready for preview.'
          });
        }
      },
    ];

    // Execute workflow steps sequentially
    for (const step of workflowSteps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      await step.action();
    }

  } catch (error) {
    addLog({
      level: 'error',
      source: 'System',
      message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    // Reset agent states
    updateAgent('manager-1', { status: 'error', progress: 0 });
    updateAgent('ui-1', { status: 'error', progress: 0 });
    updateAgent('backend-1', { status: 'error', progress: 0 });
    useProjectStore.getState().updateProjectStatus('error');
  }
};

// Simple AI chat response (non-workflow prompts)
export const getAIResponse = async (message: string): Promise<string> => {
  if (!hasValidApiKey()) {
    return 'I need an API key to respond. Please configure VITE_CLAUDE_API_KEY in your .env file.';
  }

  try {
    const response = await callClaudeWithContext(`You are NeuronForge AI, a helpful assistant for web development. 
      Respond to this message naturally and helpfully: "${message}"`, [], {
      includeMemory: true,
      includeFiles: true,
      includeProjectState: true,
      includeTaskMemory: true
    });
    return response;
  } catch (error) {
    return `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};