import { useFileContext } from '../stores/fileContextStore';
import { useLogStore } from '../stores/logStore';
import { usePreview } from '../stores/previewStore';

/**
 * Preview server manager that creates a virtual development server
 * for the generated project files
 */
export class PreviewServerManager {
  private static instance: PreviewServerManager;
  private isRunning = false;
  private port = 3001; // Use different port from main app
  private serverUrl = '';

  static getInstance(): PreviewServerManager {
    if (!PreviewServerManager.instance) {
      PreviewServerManager.instance = new PreviewServerManager();
    }
    return PreviewServerManager.instance;
  }

  /**
   * Start a virtual preview server using the generated files
   */
  async startPreviewServer(): Promise<string | null> {
    try {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Preview Server',
        message: '🚀 Starting preview server...'
      });

      // Get all generated files
      const { getAllFiles } = useFileContext.getState();
      const files = getAllFiles();
      
      // Check if we have essential files
      const hasApp = Object.keys(files).some(path => 
        path.includes('App.tsx') || path.includes('App.jsx')
      );
      const hasMain = Object.keys(files).some(path => 
        path.includes('main.tsx') || path.includes('main.jsx') || path.includes('index.tsx')
      );
      const hasIndex = Object.keys(files).some(path => 
        path.includes('index.html')
      );

      if (!hasApp || !hasMain || !hasIndex) {
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Preview Server',
          message: '⚠️ Missing essential files for preview. Generate an app first.'
        });
        return null;
      }

      // Create a virtual preview using data URLs or blob URLs
      const previewHtml = this.generatePreviewHtml(files);
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const previewUrl = URL.createObjectURL(blob);

      this.serverUrl = previewUrl;
      this.isRunning = true;

      useLogStore.getState().addLog({
        level: 'success',
        source: 'Preview Server',
        message: `✅ Preview server started: ${previewUrl.substring(0, 50)}...`
      });

      return previewUrl;
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Preview Server',
        message: `❌ Failed to start preview server: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return null;
    }
  }

  /**
   * Generate a complete HTML page with inline React code
   */
  private generatePreviewHtml(files: Record<string, any>): string {
    // Get file contents
    const appFile = Object.entries(files).find(([path]) => 
      path.includes('App.tsx') || path.includes('App.jsx')
    );
    const mainFile = Object.entries(files).find(([path]) => 
      path.includes('main.tsx') || path.includes('main.jsx') || path.includes('index.tsx')
    );
    const indexFile = Object.entries(files).find(([path]) => 
      path.includes('index.html')
    );

    if (!appFile || !mainFile) {
      throw new Error('Missing essential React files');
    }

    const appContent = appFile[1].content || '';
    const mainContent = mainFile[1].content || '';
    const indexContent = indexFile?.[1]?.content || '';

    // Create a complete React application as a single HTML file
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NeuronForge Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    code {
      font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
    }
    
    #preview-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 9999;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="preview-indicator">🚀 NeuronForge Preview</div>
  <div id="root"></div>
  
  <script type="text/babel">
    ${this.transformReactCode(appContent, mainContent)}
  </script>
</body>
</html>`;
  }

  /**
   * Transform React/TypeScript code to work in browser with Babel
   */
  private transformReactCode(appContent: string, mainContent: string): string {
    // Simple transformation to make TypeScript React code work in browser
    let transformedApp = appContent
      .replace(/import\s+React[^;]*;?\s*/g, '') // Remove React imports (already loaded)
      .replace(/import\s+[^;]*from\s+['"][^'"]*['"];?\s*/g, '') // Remove other imports
      .replace(/export\s+default\s+/, '') // Remove export default
      .replace(/interface\s+\w+\s*{[^}]*}/g, '') // Remove TypeScript interfaces
      .replace(/:\s*\w+(\[\])?/g, '') // Remove TypeScript type annotations
      .replace(/\?:/g, ':'); // Remove optional property markers

    let transformedMain = mainContent
      .replace(/import\s+React[^;]*;?\s*/g, '')
      .replace(/import\s+ReactDOM[^;]*;?\s*/g, '')
      .replace(/import\s+[^;]*from\s+['"][^'"]*['"];?\s*/g, '')
      .replace(/ReactDOM/g, 'ReactDOM')
      .replace(/React\.StrictMode/g, 'React.StrictMode');

    return `
      // App Component
      ${transformedApp}
      
      // Main rendering logic
      const { createRoot } = ReactDOM;
      const root = createRoot(document.getElementById('root'));
      
      root.render(
        React.createElement(React.StrictMode, null,
          React.createElement(App, null)
        )
      );
    `;
  }

  /**
   * Stop the preview server
   */
  stopPreviewServer(): void {
    if (this.serverUrl && this.serverUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.serverUrl);
    }
    this.isRunning = false;
    this.serverUrl = '';
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Preview Server',
      message: '🛑 Preview server stopped'
    });
  }

  /**
   * Get current server status
   */
  getStatus(): { isRunning: boolean; url: string; port: number } {
    return {
      isRunning: this.isRunning,
      url: this.serverUrl,
      port: this.port
    };
  }

  /**
   * Restart the preview server with updated files
   */
  async restartPreviewServer(): Promise<string | null> {
    this.stopPreviewServer();
    return await this.startPreviewServer();
  }
}

// Global instance
export const previewServerManager = PreviewServerManager.getInstance();

/**
 * Hook for components to interact with preview server
 */
export function usePreviewServer() {
  const preview = usePreview();
  
  return {
    manager: previewServerManager,
    
    async startGeneratedAppPreview() {
      const previewUrl = await previewServerManager.startPreviewServer();
      
      if (previewUrl) {
        preview.connectToUrl(previewUrl);
        return previewUrl;
      }
      
      return null;
    },
    
    stopGeneratedAppPreview() {
      previewServerManager.stopPreviewServer();
      preview.setSandboxUrl('');
    },
    
    async restartGeneratedAppPreview() {
      const previewUrl = await previewServerManager.restartPreviewServer();
      
      if (previewUrl) {
        preview.connectToUrl(previewUrl);
        return previewUrl;
      }
      
      return null;
    },
    
    getStatus: () => previewServerManager.getStatus()
  };
}