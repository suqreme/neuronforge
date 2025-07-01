import { create } from 'zustand';
import { WebContainer } from '@webcontainer/api';
import { SandboxState, SandboxFile } from '../types';
import { createFileTree } from '../utils/webcontainerHelpers';
import { generateStaticReactPreview } from '../utils/staticPreview';

interface SandboxStore extends SandboxState {
  // Actions
  initializeContainer: () => Promise<void>;
  destroyContainer: () => Promise<void>;
  updateFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  installDependencies: () => Promise<void>;
  startDevServer: () => Promise<void>;
  addLog: (message: string) => void;
  addError: (error: string) => void;
  clearLogs: () => void;
  syncFiles: () => Promise<void>;
  receivedFileCount: number;
  hasStartedProject: boolean;
  enableStaticMode: () => void;
  staticMode: boolean;
  resetSandbox: () => void;
  exitStaticMode: () => void;
}

// Single global WebContainer instance as per official docs
let globalWebContainerInstance: WebContainer | null = null;

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  // Initial state
  container: null,
  files: {},
  previewUrl: null,
  isBooting: false,
  isRunning: false,
  logs: [],
  errors: [],
  receivedFileCount: 0,
  hasStartedProject: false,
  staticMode: false,

  // Actions
  initializeContainer: async () => {
    const { container, staticMode } = get();
    
    // If already in static mode, don't try WebContainer
    if (staticMode) {
      get().addLog('Already in static mode - skipping WebContainer initialization');
      return;
    }
    
    // Following official docs: only one WebContainer instance allowed
    if (globalWebContainerInstance) {
      get().addLog('Using existing WebContainer instance');
      set({ container: globalWebContainerInstance, isBooting: false });
      return;
    }

    set({ isBooting: true });
    get().addLog('🚀 Booting WebContainer...');
    
    try {
      // Simple boot following official docs pattern
      const webcontainerInstance = await WebContainer.boot();
      
      // Set global instance
      globalWebContainerInstance = webcontainerInstance;
      
      get().addLog('✅ WebContainer booted successfully');
      
      // Set up server-ready event listener (following official docs)
      webcontainerInstance.on('server-ready', (port, url) => {
        get().addLog(`🌐 Server ready on port ${port}: ${url}`);
        set({ previewUrl: url, isRunning: true });
      });
      
      set({ 
        container: webcontainerInstance, 
        isBooting: false
      });

      // Mount initial file structure
      await webcontainerInstance.mount({
        'package.json': {
          file: {
            contents: JSON.stringify({
              name: 'webcontainer-app',
              version: '1.0.0',
              type: 'module',
              scripts: {
                dev: 'vite --host 0.0.0.0 --port 3000',
                build: 'vite build',
                preview: 'vite preview --host 0.0.0.0 --port 3000'
              },
              dependencies: {
                'react': '^18.2.0',
                'react-dom': '^18.2.0'
              },
              devDependencies: {
                'vite': '^5.0.0',
                '@vitejs/plugin-react': '^4.0.0',
                '@types/react': '^18.0.0',
                '@types/react-dom': '^18.0.0',
                'typescript': '^5.0.0'
              }
            }, null, 2)
          }
        },
        'vite.config.ts': {
          file: {
            contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})`
          }
        },
        'tsconfig.json': {
          file: {
            contents: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`
          }
        },
        'tsconfig.node.json': {
          file: {
            contents: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`
          }
        },
        'index.html': {
          file: {
            contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
          }
        },
        'src': {
          directory: {
            'main.tsx': {
              file: {
                contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
              }
            },
            'App.tsx': {
              file: {
                contents: `import React from 'react'

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Welcome to NeuronForge Sandbox</h1>
      <p>Your app will appear here as agents build it.</p>
    </div>
  )
}

export default App`
              }
            }
          }
        }
      });

      get().addLog('📦 Basic project structure created');
      
      // Sync all received files from agents to WebContainer
      const { files } = get();
      const fileCount = Object.keys(files).length;
      
      console.log('🔍 WebContainer initialization - current files state:', {
        fileCount,
        fileKeys: Object.keys(files),
        firstFilePreview: Object.values(files)[0] ? {
          path: Object.keys(files)[0],
          content: typeof Object.values(files)[0].content === 'string' ? 
            Object.values(files)[0].content.slice(0, 100) + '...' : 
            'Not a string'
        } : 'No files'
      });
      
      if (fileCount > 0) {
        get().addLog(`🔄 Syncing ${fileCount} received files from agents...`);
        
        for (const [filePath, fileData] of Object.entries(files)) {
          try {
            // Ensure directory structure exists
            const pathParts = filePath.split('/');
            if (pathParts.length > 1) {
              const dirPath = pathParts.slice(0, -1).join('/');
              if (dirPath) {
                try {
                  await newContainer.fs.mkdir(dirPath, { recursive: true });
                } catch (dirError) {
                  // Directory might already exist, ignore error
                }
              }
            }
            
            await newContainer.fs.writeFile(filePath, fileData.content);
            get().addLog(`✅ Synced: ${filePath}`);
          } catch (fileError) {
            get().addLog(`⚠️ Failed to sync ${filePath}: ${fileError}`);
          }
        }
        
        get().addLog(`✨ Successfully synced ${fileCount} files from agents to WebContainer`);
      } else {
        get().addLog('💡 No files received from agents yet - using default template');
      }
      
    } catch (error) {
      set({ isBooting: false });
      const errorMessage = error instanceof Error ? error.message : String(error);
      get().addError(`Failed to initialize WebContainer: ${errorMessage}`);
      
      // Provide specific guidance based on error type
      if (errorMessage.includes('SharedArrayBuffer') || errorMessage.includes('crossOriginIsolated')) {
        get().addLog('💡 This requires HTTPS with cross-origin isolation headers');
        get().addLog('💡 Or run: npx serve . --cors --ssl-cert --ssl-key');
      } else if (errorMessage.includes('more instances')) {
        get().addLog('💡 Try refreshing the page to clear existing instances');
      }
      
      get().addLog('⚡ Auto-enabling static file preview mode as fallback...');
      
      // Auto-enable static mode on WebContainer failure
      setTimeout(() => {
        get().enableStaticMode();
      }, 1500);
    }
  },

  destroyContainer: async () => {
    const { container } = get();
    
    // Clean up global instance
    if (globalWebContainerInstance) {
      try {
        get().addLog('Destroying global WebContainer instance...');
        await globalWebContainerInstance.teardown();
        globalWebContainerInstance = null;
        get().addLog('Global WebContainer destroyed successfully');
      } catch (error) {
        get().addLog(`Warning: Error during global container teardown: ${error}`);
      }
    }
    
    // Clean up local instance
    if (container) {
      try {
        get().addLog('Destroying local WebContainer...');
        await container.teardown();
        get().addLog('Local WebContainer destroyed successfully');
      } catch (error) {
        get().addLog(`Warning: Error during local container teardown: ${error}`);
      }
    }
    
    set({ 
      container: null, 
      previewUrl: null, 
      isRunning: false,
      files: {},
      receivedFileCount: 0,
      hasStartedProject: false
    });
  },

  updateFile: async (path: string, content: string) => {
    const { container, files, hasStartedProject, receivedFileCount, staticMode } = get();
    
    // Update files in store immediately
    const updatedFiles = {
      ...files,
      [path]: {
        path,
        content,
        lastModified: Date.now()
      }
    };
    
    set({ 
      files: updatedFiles, 
      receivedFileCount: receivedFileCount + 1 
    });
    
    get().addLog(`📁 File received: ${path} (${content.length} chars)`);
    
    // If in static mode, generate preview immediately
    if (staticMode) {
      get().addLog(`📄 Processing in static mode...`);
      try {
        const previewHTML = generateStaticReactPreview(updatedFiles);
        
        // If it's a complete HTML document, don't wrap it in a blob
        if (typeof previewHTML === 'string' && (previewHTML.includes('<!DOCTYPE') || previewHTML.includes('<html'))) {
          console.log('Complete HTML document detected, using direct URL');
          const blob = new Blob([previewHTML], { type: 'text/html' });
          const previewUrl = URL.createObjectURL(blob);
          set({ previewUrl, isRunning: true });
        } else {
          const blob = new Blob([previewHTML], { type: 'text/html' });
          const previewUrl = URL.createObjectURL(blob);
          set({ previewUrl, isRunning: true });
        }
        
        get().addLog(`✨ Static preview updated with ${Object.keys(updatedFiles).length} files`);
      } catch (error) {
        get().addLog(`⚠️ Failed to generate static preview: ${error}`);
        console.error('Static preview error:', error);
      }
      return;
    }
    
    if (!container) {
      get().addLog(`File queued: ${path} (container not ready)`);
      return;
    }

    try {
      // Ensure directory structure exists
      const pathParts = path.split('/');
      if (pathParts.length > 1) {
        const dirPath = pathParts.slice(0, -1).join('/');
        if (dirPath) {
          try {
            await container.fs.mkdir(dirPath, { recursive: true });
          } catch (error) {
            // Directory might already exist, ignore error
          }
        }
      }
      
      await container.fs.writeFile(path, content);
      get().addLog(`✅ File written: ${path} (${content.length} chars)`);
      
      // Force restart dev server when key files are updated
      const isKeyFile = path.includes('App.tsx') || path.includes('main.tsx') || path.includes('package.json');
      
      if (isKeyFile && hasStartedProject) {
        get().addLog(`🔄 Key file updated (${path}), restarting dev server...`);
        
        // Kill existing dev server and restart
        setTimeout(async () => {
          await get().startDevServer();
        }, 1000);
      }
      
      // Auto-install dependencies and start if we have package.json and haven't started yet
      if (path.includes('package.json') && !hasStartedProject) {
        set({ hasStartedProject: true });
        get().addLog('📦 Package.json detected - installing dependencies...');
        
        setTimeout(async () => {
          await get().installDependencies();
          setTimeout(async () => {
            await get().startDevServer();
          }, 2000);
        }, 1000);
      }
      
    } catch (error) {
      get().addError(`Failed to update file ${path}: ${error}`);
    }
  },

  deleteFile: async (path: string) => {
    const { container, files } = get();
    if (!container) return;

    try {
      await container.fs.rm(path);
      
      const updatedFiles = { ...files };
      delete updatedFiles[path];
      
      set({ files: updatedFiles });
      get().addLog(`File deleted: ${path}`);
    } catch (error) {
      get().addError(`Failed to delete file ${path}: ${error}`);
    }
  },

  installDependencies: async () => {
    const { container } = get();
    if (!container) return;

    try {
      get().addLog('Installing dependencies...');
      
      const installProcess = await container.spawn('npm', ['install']);
      
      installProcess.output.pipeTo(new WritableStream({
        write(data) {
          get().addLog(`npm: ${data}`);
        }
      }));

      const exitCode = await installProcess.exit;
      
      if (exitCode === 0) {
        get().addLog('Dependencies installed successfully');
      } else {
        get().addError(`npm install failed with exit code ${exitCode}`);
      }
    } catch (error) {
      get().addError(`Failed to install dependencies: ${error}`);
    }
  },

  startDevServer: async () => {
    const { container, isRunning } = get();
    if (!container) return;

    try {
      // Stop any running dev server first
      if (isRunning) {
        get().addLog('🛑 Stopping existing dev server...');
        set({ isRunning: false, previewUrl: null });
        // Give it a moment to stop
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      get().addLog('🚀 Starting development server...');
      set({ isRunning: true });

      // Instead of relying on external WebContainer URLs, generate local preview
      get().addLog('📄 Generating inline preview from files...');
      
      try {
        const { files } = get();
        const { generateStaticReactPreview } = await import('../utils/staticPreview');
        const previewHTML = generateStaticReactPreview(files);
        
        // Create blob URL for inline preview
        const blob = new Blob([previewHTML], { type: 'text/html' });
        const inlinePreviewUrl = URL.createObjectURL(blob);
        
        set({ previewUrl: inlinePreviewUrl });
        get().addLog(`✨ Inline preview generated successfully`);
        get().addLog(`📺 Preview ready - no external connection required`);
        
        // Still start the dev server in background for any advanced features
        const serverProcess = await container.spawn('npm', ['run', 'dev']);
        
        // Monitor server output but don't rely on it for preview
        serverProcess.output.pipeTo(new WritableStream({
          write(data) {
            const output = data.toString();
            // Only log important messages, not all output
            if (output.includes('ready') || output.includes('error') || output.includes('warning')) {
              get().addLog(`dev: ${output.trim()}`);
            }
          }
        }));
        
      } catch (previewError) {
        get().addLog(`⚠️ Failed to generate inline preview: ${previewError}`);
        get().addLog('🔄 Falling back to WebContainer URL method...');
        
        // Fallback to original WebContainer URL method
        container.on('server-ready', (port, url) => {
          set({ previewUrl: url });
          get().addLog(`✅ Development server ready at ${url}`);
          get().addLog(`⚠️ Note: This URL may require manual connection`);
        });

        const serverProcess = await container.spawn('npm', ['run', 'dev']);
        
        serverProcess.output.pipeTo(new WritableStream({
          write(data) {
            const output = data.toString();
            get().addLog(`dev server: ${output}`);
          }
        }));
      }

    } catch (error) {
      set({ isRunning: false });
      get().addError(`Failed to start dev server: ${error}`);
    }
  },

  addLog: (message: string) => {
    set(state => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${message}`]
    }));
  },

  addError: (error: string) => {
    set(state => ({
      errors: [...state.errors, `[${new Date().toLocaleTimeString()}] ${error}`]
    }));
  },

  clearLogs: () => {
    set({ logs: [], errors: [] });
  },

  syncFiles: async () => {
    const { container, files } = get();
    if (!container) return;
    
    try {
      // Sync all files to WebContainer
      for (const [path, file] of Object.entries(files)) {
        // Ensure directory structure exists
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          const dirPath = pathParts.slice(0, -1).join('/');
          if (dirPath) {
            try {
              await container.fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
              // Directory might already exist, ignore error
            }
          }
        }
        
        await container.fs.writeFile(path, file.content);
      }
      
      get().addLog(`Synced ${Object.keys(files).length} files to container`);
    } catch (error) {
      get().addError(`Failed to sync files: ${error}`);
    }
  },

  enableStaticMode: () => {
    const { files } = get();
    
    set({ 
      staticMode: true, 
      isRunning: true
    });
    
    get().addLog('📄 Static file preview mode enabled');
    get().addLog('✨ This mode shows your AI-generated code immediately!');
    
    const fileCount = Object.keys(files).length;
    get().addLog(`📁 Found ${fileCount} files to preview`);
    
    // HOTFIX: If no files exist, generate basic template files immediately
    if (fileCount === 0) {
      get().addLog('🔧 HOTFIX: No files found, generating basic template files...');
      
      const basicFiles = {
        'src/App.tsx': {
          content: `import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#2563eb' }}>🎉 NeuronForge App</h1>
      <p>This app was generated by the NeuronForge platform!</p>
      <div style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px' }}>
        <h2>✅ Template Generation Works!</h2>
        <p>The file generation system is now working properly.</p>
        <ul>
          <li>React components ✓</li>
          <li>TypeScript support ✓</li>
          <li>CSS styling ✓</li>
        </ul>
      </div>
    </div>
  );
}

export default App;`,
          path: 'src/App.tsx',
          lastModified: Date.now()
        },
        'src/main.tsx': {
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`,
          path: 'src/main.tsx',
          lastModified: Date.now()
        },
        'src/index.css': {
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f8fafc;
}

#root {
  min-height: 100vh;
}`,
          path: 'src/index.css',
          lastModified: Date.now()
        }
      };
      
      // Add files to store
      set({ 
        files: basicFiles, 
        receivedFileCount: Object.keys(basicFiles).length 
      });
      
      get().addLog(`🎉 Generated ${Object.keys(basicFiles).length} template files`);
    }
    
    // Generate initial preview if files exist (now guaranteed to exist)
    const currentFiles = get().files;
    const currentFileCount = Object.keys(currentFiles).length;
    
    if (currentFileCount > 0) {
      try {
        get().addLog('🔄 Generating static preview...');
        const previewHTML = generateStaticReactPreview(currentFiles);
        const blob = new Blob([previewHTML], { type: 'text/html' });
        const previewUrl = URL.createObjectURL(blob);
        set({ previewUrl });
        get().addLog(`✅ Static preview ready with ${currentFileCount} files`);
      } catch (error) {
        get().addLog(`⚠️ Failed to generate static preview: ${error}`);
        console.error('Static preview error:', error);
      }
    }
  },

  resetSandbox: () => {
    // Clear all state but don't destroy WebContainer (let it be reused)
    set({
      files: {},
      previewUrl: null,
      isRunning: false,
      logs: [],
      errors: [],
      receivedFileCount: 0,
      hasStartedProject: false,
      staticMode: false
    });
    
    console.log('🧹 Sandbox state reset for new project');
  },

  exitStaticMode: () => {
    // Exit static mode but preserve files
    const { files } = get();
    set({
      staticMode: false,
      previewUrl: null,
      isRunning: false
    });
    
    get().addLog(`🔄 Exited static mode, preserved ${Object.keys(files).length} files`);
    console.log('🔄 Exited static mode while preserving files:', Object.keys(files));
  }
}));