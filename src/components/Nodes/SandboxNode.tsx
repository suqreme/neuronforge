import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSandboxStore } from '../../stores/sandboxStore';
import { useNodesStore } from '../../stores/nodesStore';
import { generatePreviewHTML, isWebContainerSupported } from '../../utils/webcontainerHelpers';
import { TaskMessage } from '../../types/messages';

interface SandboxNodeProps {
  id: string;
  data: {
    title?: string;
    autoStart?: boolean;
  };
}

export const SandboxNode: React.FC<SandboxNodeProps> = ({ id, data }) => {
  const {
    container,
    previewUrl,
    isBooting,
    isRunning,
    logs,
    errors,
    receivedFileCount,
    files,
    staticMode,
    updateFile,
    initializeContainer,
    destroyContainer,
    installDependencies,
    startDevServer,
    addLog,
    clearLogs,
    enableStaticMode,
    exitStaticMode
  } = useSandboxStore();

  const { setSandbox, subscribeToMessages } = useNodesStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Register this node as the sandbox
    setSandbox(id);
    
    // Set up message listener for file updates
    const unsubscribe = subscribeToMessages(id, (message: TaskMessage) => {
      console.log(`🔍 Sandbox ${id} received message:`, message);
      
      if (message.payload.data?.type === 'file_update') {
        const { filePath, fileContent } = message.payload.data;
        addLog(`📁 Received file: ${filePath}`);
        updateFile(filePath, fileContent);
        
        // Auto-enable static mode for UI files (HTML, React, etc.)
        const isUIFile = filePath.endsWith('.html') || 
                        filePath.endsWith('.tsx') || 
                        filePath.endsWith('.jsx') || 
                        filePath.includes('App.') ||
                        filePath.includes('component');
                        
        if (isUIFile && !staticMode && !container) {
          addLog(`🎨 UI file detected (${filePath}) - auto-enabling static preview mode`);
          setTimeout(() => {
            enableStaticMode();
            addLog(`✨ Auto-started preview - ready to view your application!`);
          }, 1000);
        }
      }
    });

    // Check WebContainer support but don't auto-initialize or show errors
    if (!isWebContainerSupported()) {
      setIsSupported(false);
      // Don't add log here - only when user explicitly tries to use WebContainer
    }

    // REMOVED: Auto-initialization - let user choose the mode they want
    // No more automatic WebContainer initialization

    // Cleanup on unmount
    return () => {
      unsubscribe();
      // Note: Don't destroy container on unmount as it should persist
      // Container will be cleaned up on page unload or manual destroy
    };
  }, []);

  // Set iframe src when previewUrl changes (following official docs pattern)
  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      addLog(`🔗 Setting iframe src to: ${previewUrl}`);
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  const handleInitialize = async () => {
    try {
      addLog('🚀 Attempting to initialize WebContainer...');
      await initializeContainer();
      addLog('✅ Container initialized successfully');
      setIsSupported(true);
    } catch (error) {
      // Handle SES and other WebContainer errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('SES') || errorMessage.includes('lockdown')) {
        addLog(`❌ SES/Lockdown error detected - WebContainer not supported in this environment`);
      } else if (errorMessage.includes('SharedArrayBuffer')) {
        addLog(`❌ SharedArrayBuffer not available - requires cross-origin isolation`);
      } else {
        addLog(`❌ Failed to initialize container: ${errorMessage}`);
      }
      
      addLog('💡 WebContainer requires HTTPS with cross-origin isolation');
      addLog('⚡ Auto-switching to Static Preview Mode...');
      console.error('WebContainer initialization error:', error);
      
      // Suppress SES errors in console
      if (errorMessage.includes('SES')) {
        console.warn('SES error suppressed - this is expected when WebContainer is not supported');
      }
      
      // Auto-enable static mode after failed initialization
      setTimeout(() => {
        enableStaticMode();
      }, 2000);
    }
  };

  const handleInstallAndStart = async () => {
    if (!container) return;
    
    try {
      await installDependencies();
      await startDevServer();
    } catch (error) {
      addLog(`Failed to start development environment: ${error}`);
    }
  };

  const handleDestroy = async () => {
    try {
      await destroyContainer();
      addLog('Container destroyed');
    } catch (error) {
      addLog(`Failed to destroy container: ${error}`);
    }
  };

  const getPreviewContent = () => {
    if (staticMode) {
      // Show static file preview
      const filesList = Object.entries(files || {}).map(([path, file]) => {
        // Ensure file is an object and has content
        if (!file || typeof file !== 'object') {
          return `<div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
            <strong>${path}</strong>
            <pre style="margin: 4px 0; overflow-x: auto; font-size: 12px;">Invalid file data</pre>
          </div>`;
        }
        
        const content = typeof file.content === 'string' ? file.content : String(file.content || '');
        const truncatedContent = content.length > 200 ? content.slice(0, 200) + '...' : content;
        
        return `<div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <strong>${path}</strong>
          <pre style="margin: 4px 0; overflow-x: auto; font-size: 12px;">${truncatedContent}</pre>
        </div>`;
      }).join('');
      
      return generatePreviewHTML(`
        <div style="padding: 16px;">
          <h3>📄 Static File Preview</h3>
          <p>WebContainer failed, showing generated files:</p>
          <div style="max-height: 300px; overflow-y: auto;">
            ${filesList.length > 0 ? filesList : '<p>No files generated yet...</p>'}
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #666;">
            ${receivedFileCount} files received from agents
          </p>
        </div>
      `);
    }

    if (!isSupported) {
      return generatePreviewHTML(`
        <div class="error">
          <h3>⚠️ WebContainer Support Check Failed</h3>
          <p>Support check failed but you can still try to initialize:</p>
          <ul>
            <li>✅ Modern browser detected</li>
            <li>❓ Cross-origin isolation may be missing</li>
            <li>💡 Development mode may still work</li>
          </ul>
          <p><strong>Click "Initialize" to attempt manual startup</strong></p>
        </div>
      `);
    }

    if (isBooting) {
      return generatePreviewHTML(`
        <div class="loading">
          <h3>🚀 Booting WebContainer...</h3>
          <p>Setting up your development environment</p>
        </div>
      `);
    }

    if (!container) {
      const fileCount = Object.keys(files || {}).length;
      if (fileCount > 0) {
        const hasUIFiles = Object.keys(files || {}).some(path => 
          path.endsWith('.html') || path.endsWith('.tsx') || path.endsWith('.jsx') || path.includes('App.')
        );
        
        return generatePreviewHTML(`
          <div class="loading">
            <h3>🧠 NeuronForge Sandbox</h3>
            <p>${fileCount} files ready for preview</p>
            ${hasUIFiles ? 
              '<p>🎨 UI files detected - Click "Static Mode" for immediate preview!</p>' : 
              '<p>Click "Static Mode" for immediate preview or "WebContainer" for live development</p>'
            }
            <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 6px; border-left: 4px solid #4CAF50;">
              <strong>💡 Tip:</strong> Static Mode works for both HTML and React components!
            </div>
          </div>
        `);
      }
      return generatePreviewHTML(`
        <div class="loading">
          <h3>🧠 NeuronForge Sandbox</h3>
          <p>Waiting for AI agents to create your application...</p>
          <p>UI components will appear here as they're generated</p>
        </div>
      `);
    }

    if (!isRunning) {
      return generatePreviewHTML(`
        <div class="loading">
          <h3>⚙️ Container Ready</h3>
          <p>Click "Install & Start" to run your application</p>
        </div>
      `);
    }

    return null; // Will show iframe with previewUrl
  };

  const previewContent = getPreviewContent();

  return (
    <div className="sandbox-node bg-white border-2 border-gray-200 rounded-lg shadow-lg w-full h-full min-w-[600px] min-h-[400px] flex flex-col">
      {/* React Flow Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="files-input"
        style={{
          background: '#10b981',
          border: '2px solid #fff',
          width: 12,
          height: 12,
          left: -6
        }}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <h3 className="font-semibold text-gray-800">
            {data.title || 'Sandbox Agent'}
          </h3>
          <span className={`text-xs px-2 py-1 rounded ${
            staticMode ? 'bg-purple-100 text-purple-800' :
            isBooting ? 'bg-yellow-100 text-yellow-800' : 
            container ? (isRunning ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800') : 
            'bg-gray-100 text-gray-800'
          }`}>
            {staticMode ? 'Static Mode' : isBooting ? 'Booting' : container ? (isRunning ? 'Running' : 'Ready') : 'Idle'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Console {logs.length > 0 && `(${logs.length})`}
          </button>
          
          {/* Mode switching buttons */}
          {!container && !isBooting && (
            <>
              {!staticMode ? (
                <button
                  onClick={enableStaticMode}
                  className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors font-medium"
                  title="Enable static file preview mode - works immediately!"
                >
                  📄 Static Mode
                </button>
              ) : (
                <button
                  onClick={exitStaticMode}
                  className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                  title="Exit static mode and return to container options (preserves files)"
                >
                  🔄 Exit Static
                </button>
              )}
              
              {!staticMode && (
                <button
                  onClick={handleInitialize}
                  className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  title={!isSupported ? "Attempting manual initialization despite support check failure" : "Initialize WebContainer (requires HTTPS)"}
                >
                  {!isSupported ? "Try WebContainer" : "⚡ WebContainer"}
                </button>
              )}
              
              {/* Test file generation button */}
              <button
                onClick={() => {
                  console.log('🧪 FORCING TEST FILE GENERATION');
                  
                  // Generate test files directly
                  const testFiles = {
                    'src/App.tsx': {
                      content: `import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#2563eb' }}>🎉 Test App Generated!</h1>
      <p>This is a test file generated directly by the sandbox.</p>
      <div style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px' }}>
        <h2>✅ File Generation Works!</h2>
        <p>If you can see this, the file system is working properly.</p>
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
                    }
                  };
                  
                  // Update sandbox store directly
                  import('../../stores/sandboxStore').then(({ useSandboxStore }) => {
                    const store = useSandboxStore.getState();
                    store.addLog('🧪 Generating test files directly...');
                    
                    // Add files to store
                    Object.entries(testFiles).forEach(([path, fileData]) => {
                      store.updateFile(path, fileData.content);
                      store.addLog(`✅ Generated test file: ${path}`);
                    });
                    
                    store.addLog(`🎉 Generated ${Object.keys(testFiles).length} test files successfully!`);
                  });
                }}
                className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                title="Generate test files directly to debug file system"
              >
                🧪 Test Files
              </button>
              
              {/* Debug button for testing */}
              <button
                onClick={() => {
                  console.log('🔍 DEBUG: Current sandbox state:', {
                    files: Object.keys(files || {}),
                    staticMode,
                    isRunning,
                    receivedFileCount,
                    previewUrl
                  });
                  
                  // Force regenerate preview
                  if (staticMode && Object.keys(files || {}).length > 0) {
                    import('../../utils/staticPreview').then(({ generateStaticReactPreview }) => {
                      const newPreview = generateStaticReactPreview(files);
                      console.log('🔄 Regenerated preview:', newPreview.slice(0, 200));
                    });
                  }
                }}
                className="px-2 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                title="Debug current state and regenerate preview"
              >
                🔍 Debug
              </button>
            </>
          )}
          
          {container && !isRunning && (
            <button
              onClick={handleInstallAndStart}
              className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            >
              Install & Start
            </button>
          )}
          
          {container && (
            <button
              onClick={handleDestroy}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              title="Destroy container and reset"
            >
              Reset
            </button>
          )}
          
          {!container && !isBooting && !isSupported && !staticMode && (
            <button
              onClick={() => {
                handleDestroy().then(() => {
                  setTimeout(handleInitialize, 1000);
                });
              }}
              className="px-2 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
              title="Force cleanup and retry initialization"
            >
              Force Reset
            </button>
          )}
          
          
          {container && isRunning && (
            <>
              <button
                onClick={async () => {
                  addLog('🔄 Regenerating inline preview...');
                  try {
                    const { generateStaticReactPreview } = await import('../../utils/staticPreview');
                    const previewHTML = generateStaticReactPreview(files);
                    const blob = new Blob([previewHTML], { type: 'text/html' });
                    const newPreviewUrl = URL.createObjectURL(blob);
                    
                    // Update the sandbox store with new preview URL
                    import('../../stores/sandboxStore').then(({ useSandboxStore }) => {
                      useSandboxStore.setState({ previewUrl: newPreviewUrl });
                    });
                    
                    addLog('✨ Preview regenerated successfully');
                  } catch (error) {
                    addLog(`⚠️ Failed to regenerate preview: ${error}`);
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                title="Regenerate inline preview from current files"
              >
                🔄 Preview
              </button>
              <button
                onClick={() => {
                  addLog('🔄 Manually restarting dev server...');
                  startDevServer();
                }}
                className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                title="Restart dev server to reload files"
              >
                🔄 Server
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="relative min-h-80 flex-1 bg-white">
        {previewUrl && isRunning ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            title="Sandbox Preview"
          />
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={previewContent || ''}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Sandbox Status"
          />
        )}
      </div>

      {/* Console Panel */}
      {showConsole && (
        <div className="border-t border-gray-200 bg-gray-900 text-green-400 font-mono text-xs">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
            <span className="text-gray-300">Console Output</span>
            <button
              onClick={clearLogs}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          
          <div className="h-32 overflow-y-auto p-4 space-y-1">
            {logs.length === 0 && errors.length === 0 ? (
              <div className="text-gray-500">No output</div>
            ) : (
              <>
                {logs.map((log, index) => (
                  <div key={`log-${index}`} className="text-green-400">
                    {log}
                  </div>
                ))}
                {errors.map((error, index) => (
                  <div key={`error-${index}`} className="text-red-400">
                    ❌ {error}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>Files: {receivedFileCount}</span>
            {previewUrl && (
              <span className="flex items-center gap-2">
                {previewUrl.startsWith('blob:') ? (
                  <span className="text-green-600 font-medium">
                    📱 Inline Preview Ready
                  </span>
                ) : (
                  <a 
                    href={previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    title="Open preview in new tab"
                  >
                    🌐 External: {previewUrl.length > 30 ? previewUrl.slice(0, 30) + '...' : previewUrl}
                  </a>
                )}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <span className="text-red-600">
                {errors.length} error{errors.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-gray-400">
              ID: {id.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};