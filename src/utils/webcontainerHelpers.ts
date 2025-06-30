import { WebContainer } from '@webcontainer/api';
import { SandboxFile } from '../types';

export const createFileTree = (files: Record<string, SandboxFile>) => {
  const tree: any = {};
  
  Object.values(files).forEach(file => {
    const pathParts = file.path.split('/');
    let current = tree;
    
    pathParts.forEach((part, index) => {
      if (index === pathParts.length - 1) {
        // This is a file
        current[part] = {
          file: {
            contents: file.content
          }
        };
      } else {
        // This is a directory
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    });
  });
  
  return tree;
};

export const syncFilesToContainer = async (
  container: WebContainer,
  files: Record<string, SandboxFile>
) => {
  const fileTree = createFileTree(files);
  await container.mount(fileTree);
};

export const generatePreviewHTML = (content: string, title = 'Preview') => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .error {
            background: #fee;
            border: 1px solid #fcc;
            padding: 10px;
            border-radius: 4px;
            color: #c33;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;
};

export const createDefaultPackageJson = (name = 'sandbox-app') => ({
  name,
  version: '1.0.0',
  type: 'module',
  scripts: {
    dev: 'vite --host 0.0.0.0 --port 3000',
    build: 'vite build',
    preview: 'vite preview'
  },
  dependencies: {
    'react': '^18.2.0',
    'react-dom': '^18.2.0'
  },
  devDependencies: {
    'vite': '^5.0.0',
    '@vitejs/plugin-react': '^4.0.0',
    '@types/react': '^18.0.0',
    '@types/react-dom': '^18.0.0'
  }
});

export const createViteConfig = () => `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  }
})`;

export const createIndexHtml = (title = 'Sandbox App') => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

export const createReactMain = () => `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

export const createDefaultApp = () => `import React from 'react'

function App() {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>🧠 NeuronForge Sandbox</h1>
      <p>Your application will appear here as AI agents build it.</p>
      <div style={{
        background: '#f0f0f0',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h3>Ready for Development</h3>
        <p>This sandbox is connected to your agent workflow. Any changes made by agents will appear here instantly.</p>
      </div>
    </div>
  )
}

export default App`;

export const parseWebContainerError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

export const isWebContainerSupported = (): boolean => {
  // Check if we're in a browser environment with necessary APIs
  if (typeof window === 'undefined') return false;
  
  // Check for SharedArrayBuffer support (required by WebContainer)
  if (typeof SharedArrayBuffer === 'undefined') {
    console.warn('WebContainer: SharedArrayBuffer not available - cross-origin isolation required');
    console.warn('To fix: Serve with HTTPS and proper headers:');
    console.warn('  Cross-Origin-Embedder-Policy: require-corp');
    console.warn('  Cross-Origin-Opener-Policy: same-origin');
    return false;
  }
  
  // Cross-origin isolation is required for WebContainer
  if (!crossOriginIsolated) {
    console.warn('WebContainer: Cross-origin isolation not enabled');
    console.warn('Current environment does not support WebContainer');
    console.warn('Static preview mode will be used instead');
    return false;
  }
  
  return true;
};