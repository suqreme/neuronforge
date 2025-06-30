import { aiService, AIGenerationRequest } from '../services/aiService';
import { useAPIKeysStore } from '../stores/apiKeysStore';

// AI-powered file content generators with template fallbacks
export const generateAIContent = async (
  type: 'ui' | 'backend',
  taskDescription: string,
  appName: string,
  framework?: string
): Promise<{ files: Array<{ path: string; content: string; description: string }> } | null> => {
  try {
    const apiKey = useAPIKeysStore.getState().getActiveKey();
    if (!apiKey) {
      console.log('No API key available, using template fallback');
      return null;
    }

    const request: AIGenerationRequest = {
      type,
      taskDescription,
      appName,
      framework,
      additionalContext: `Generate a complete ${type === 'ui' ? 'React frontend' : 'Express backend'} application.`
    };

    const response = await aiService.generateCode(apiKey, request);
    console.log(`✨ AI generated ${response.files.length} files for ${type} agent`);
    
    return {
      files: response.files.map(file => ({
        path: file.path.startsWith('/') ? file.path.slice(1) : file.path,
        content: file.content,
        description: file.description
      }))
    };
  } catch (error) {
    console.error(`AI generation failed for ${type}:`, error);
    return null;
  }
};

// Enhanced file generator that tries AI first, falls back to templates
export const getFileContent = async (
  fileName: string, 
  context: any = {}
): Promise<string> => {
  const { appName = 'My App', components = [], framework = 'React', taskDescription } = context;
  
  // Try AI generation for main files if task description is provided
  if (taskDescription && (fileName.includes('App.tsx') || fileName.includes('server'))) {
    try {
      const type = fileName.includes('server') ? 'backend' : 'ui';
      const aiResult = await generateAIContent(type, taskDescription, appName, framework);
      
      if (aiResult?.files.length > 0) {
        // Find the most relevant file from AI response
        const relevantFile = aiResult.files.find(file => 
          file.path.includes(fileName.replace('.tsx', '').replace('.ts', '').replace('.js', ''))
        ) || aiResult.files[0];
        
        return relevantFile.content;
      }
    } catch (error) {
      console.log('AI generation failed, using template:', error);
    }
  }
  
  // Fallback to template generation
  return generateTemplateContent(fileName, context);
};

// Original template-based generators (renamed for clarity)
export const generateTemplateContent = (fileName: string, context: any = {}): string => {
  const { appName = 'My App', components = [], framework = 'React', taskDescription = '' } = context;
  
  console.log(`🔧 Generating template for ${fileName} with context:`, { appName, components, framework, taskDescription });
  
  if (fileName.endsWith('.tsx') && !fileName.includes('App.tsx') && !fileName.includes('main.tsx')) {
    // Component file
    const componentName = fileName.replace('.tsx', '').replace(/.*\//, '');
    return generateReactComponent(componentName, context);
  }
  
  if (fileName.includes('App.tsx')) {
    return generateAppTsx(appName, components, taskDescription);
  }
  
  if (fileName.includes('main.tsx')) {
    return generateMainTsx();
  }
  
  if (fileName.includes('package.json')) {
    return generatePackageJson(appName, framework);
  }
  
  if (fileName.includes('server.js') || fileName.includes('server.ts')) {
    return generateServerFile(appName);
  }
  
  if (fileName.includes('routes/') && fileName.endsWith('.js')) {
    const routeName = fileName.replace('.js', '').replace(/.*\//, '');
    return generateExpressRoute(routeName);
  }
  
  if (fileName.includes('index.css')) {
    return generateIndexCss();
  }
  
  if (fileName.includes('App.css')) {
    return generateAppCss();
  }
  
  if (fileName.endsWith('.css')) {
    return generateGenericCss(fileName);
  }
  
  // Default fallback - ensure valid React component
  const componentName = fileName.replace(/\.[^/.]+$/, "").replace(/.*\//, "");
  return `import React from 'react';

// Generated file: ${fileName}
// Created by NeuronForge AI Agent

export default function ${componentName}Component() {
  return (
    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '8px' }}>
      <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>${componentName}</h3>
      <p style={{ fontSize: '14px', color: '#6b7280' }}>
        This component was generated automatically from: ${taskDescription || 'template'}
      </p>
    </div>
  );
}`;
};

// File content generators for realistic code (template fallbacks)
export const generateReactComponent = (componentName: string, props: any = {}) => {
  const { description, features = [] } = props;
  
  const componentCode = `import React, { useState } from 'react';

interface ${componentName}Props {
  className?: string;
}

export default function ${componentName}({ className }: ${componentName}Props) {
  const [loading, setLoading] = useState(false);

  return (
    <div className={\`${componentName.toLowerCase()}-container \${className || ''}\`}>
      <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          ${componentName}
        </h2>
        ${description ? `
        <p className="text-sm text-gray-600 mb-4">
          ${description}
        </p>` : ''}
        
        ${features.length > 0 ? `
        <div className="space-y-2">
          ${features.map((feature: string) => `
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-700">${feature}</span>
          </div>`).join('')}
        </div>` : ''}
        
        <div className="mt-4 flex items-center space-x-2">
          <button 
            onClick={() => setLoading(!loading)}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Action'}
          </button>
        </div>
      </div>
    </div>
  );
}`;

  return componentCode;
};

export const generateExpressRoute = (routeName: string, endpoints: string[] = []) => {
  const entityName = routeName.toLowerCase();
  const EntityName = routeName.charAt(0).toUpperCase() + routeName.slice(1);
  
  const routeCode = `import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// ${EntityName} model (simplified)
interface ${EntityName} {
  id: string;
  title: string;
  content?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage (replace with actual database)
let ${entityName}Store: ${EntityName}[] = [];

// GET /${entityName}s - Get all ${entityName}s
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: ${entityName}Store,
      total: ${entityName}Store.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ${entityName}s'
    });
  }
});

// GET /${entityName}s/:id - Get single ${entityName}
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ${entityName} = ${entityName}Store.find(item => item.id === id);
    
    if (!${entityName}) {
      return res.status(404).json({
        success: false,
        error: '${EntityName} not found'
      });
    }
    
    res.json({
      success: true,
      data: ${entityName}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ${entityName}'
    });
  }
});

// POST /${entityName}s - Create new ${entityName}
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }
    
    const new${EntityName}: ${EntityName} = {
      id: Date.now().toString(),
      title,
      content: content || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    ${entityName}Store.push(new${EntityName});
    
    res.status(201).json({
      success: true,
      data: new${EntityName}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create ${entityName}'
    });
  }
});

// PUT /${entityName}s/:id - Update ${entityName}
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    
    const ${entityName}Index = ${entityName}Store.findIndex(item => item.id === id);
    
    if (${entityName}Index === -1) {
      return res.status(404).json({
        success: false,
        error: '${EntityName} not found'
      });
    }
    
    ${entityName}Store[${entityName}Index] = {
      ...${entityName}Store[${entityName}Index],
      title: title || ${entityName}Store[${entityName}Index].title,
      content: content !== undefined ? content : ${entityName}Store[${entityName}Index].content,
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: ${entityName}Store[${entityName}Index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update ${entityName}'
    });
  }
});

// DELETE /${entityName}s/:id - Delete ${entityName}
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ${entityName}Index = ${entityName}Store.findIndex(item => item.id === id);
    
    if (${entityName}Index === -1) {
      return res.status(404).json({
        success: false,
        error: '${EntityName} not found'
      });
    }
    
    const deleted${EntityName} = ${entityName}Store.splice(${entityName}Index, 1)[0];
    
    res.json({
      success: true,
      data: deleted${EntityName}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete ${entityName}'
    });
  }
});

export default router;`;

  return routeCode;
};

export const generateServerFile = (appName: string = 'sandbox-app') => {
  return `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import notesRouter from './routes/notes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/notes', notesRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`📚 API Documentation: http://localhost:\${PORT}/health\`);
});

export default app;`;
};

export const generatePackageJson = (appName: string, framework: string = 'React') => {
  const isReactApp = framework.toLowerCase().includes('react');
  
  return JSON.stringify({
    name: appName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    type: 'module',
    description: `Generated ${framework} application`,
    scripts: {
      dev: isReactApp ? 'vite --host 0.0.0.0 --port 3000' : 'node server.js',
      build: isReactApp ? 'vite build' : 'tsc',
      preview: isReactApp ? 'vite preview' : 'node dist/server.js',
      'dev:server': 'nodemon server.js'
    },
    dependencies: isReactApp ? {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    } : {
      'express': '^4.18.2',
      'cors': '^2.8.5',
      'dotenv': '^16.3.1'
    },
    devDependencies: isReactApp ? {
      'vite': '^5.0.0',
      '@vitejs/plugin-react': '^4.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
      'typescript': '^5.0.0'
    } : {
      '@types/express': '^4.17.17',
      '@types/cors': '^2.8.14',
      '@types/node': '^20.5.0',
      'nodemon': '^3.0.1',
      'typescript': '^5.0.0'
    }
  }, null, 2);
};

export const generateAppTsx = (appName: string, components: string[] = [], taskDescription: string = '') => {
  return `import React from 'react';
import './App.css';

// Import generated components
${components.map(comp => `import ${comp} from './components/${comp}';`).join('\n')}

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          ${appName}
        </h1>
        <p className="text-gray-600 mb-8">
          Built with NeuronForge AI Agent Collaboration
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        ${components.length > 0 ? `
        <div className="grid gap-6">
          ${components.map(comp => `
          <section>
            <${comp} />
          </section>`).join('')}
        </div>` : `
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🧠</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Your app is being built by AI agents
          </h2>
          <p className="text-gray-600">
            Components will appear here as they're generated
          </p>
        </div>`}
      </main>

      <footer className="mt-12 py-4 text-center text-sm text-gray-500">
        Generated by NeuronForge
      </footer>
    </div>
  );
}

export default App;`;
};

export const generateMainTsx = () => {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`;
};

export const generateIndexCss = () => {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.app-header {
  padding: 2rem 0;
  text-align: center;
}`;
};

export const generateAppCss = () => {
  return `.App {
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.app-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.app-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

.grid {
  display: grid;
  gap: 1.5rem;
}

section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.text-center {
  text-align: center;
}

.py-12 {
  padding: 3rem 0;
}

.text-6xl {
  font-size: 4rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.text-xl {
  font-size: 1.25rem;
}

.font-semibold {
  font-weight: 600;
}

.text-gray-800 {
  color: #1f2937;
}

.text-gray-600 {
  color: #6b7280;
}

.mb-2 {
  margin-bottom: 0.5rem;
}`;
};

export const generateGenericCss = (fileName: string) => {
  const componentName = fileName.replace('.css', '').replace(/.*\//, '');
  return `/* Generated styles for ${componentName} */
.${componentName.toLowerCase()} {
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
}

.${componentName.toLowerCase()}-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

.${componentName.toLowerCase()}-content {
  color: #6b7280;
  line-height: 1.6;
}`;
};

// Legacy sync version for backwards compatibility
export const getFileContentSync = (fileName: string, context: any = {}) => {
  return generateTemplateContent(fileName, context);
};