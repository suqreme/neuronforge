import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLogStore } from '../../stores/logStore';
import { usePreview } from '../../stores/previewStore';
import { generateFallbackApp } from '../../utils/fallbackGenerator';
import { previewLogger } from '../../utils/previewLogger';
import PreviewIframe from './PreviewIframe';

const LivePreview: React.FC = () => {
  const { project } = useProjectStore();
  const { openTabs } = useEditorStore();
  const addLog = useLogStore((state) => state.addLog);
  const preview = usePreview();
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error' | 'fallback' | 'no_server'>('loading');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>('');

  // Check if we have essential files for a React app
  const checkAppIntegrity = () => {
    const fileNames = openTabs.map(tab => tab.path);
    const hasApp = fileNames.some(name => name.includes('App.tsx') || name.includes('App.jsx'));
    const hasMain = fileNames.some(name => name.includes('main.tsx') || name.includes('main.jsx') || name.includes('index.tsx') || name.includes('index.jsx'));
    const hasValidFiles = openTabs.length > 0;

    return {
      hasApp,
      hasMain,
      hasValidFiles,
      fileCount: openTabs.length,
      isComplete: hasApp && hasValidFiles
    };
  };

  const integrity = checkAppIntegrity();

  // Monitor file changes, project status, and preview URL
  useEffect(() => {
    const oldState = previewState;
    let newState = previewState;
    
    // Check if we have a preview URL configured
    if (!preview.getPreviewUrl()) {
      newState = 'no_server';
      setPreviewState('no_server');
      setLastError('No development server configured');
    } else if (preview.config.connectionStatus === 'error') {
      newState = 'error';
      setPreviewState('error');
      setLastError('Failed to connect to development server');
    } else if (preview.config.connectionStatus === 'connected' && preview.isPreviewAvailable()) {
      newState = 'ready';
      setPreviewState('ready');
      setLastError(null);
    } else if (project?.status === 'error') {
      newState = 'error';
      setPreviewState('error');
      setLastError('Build failed - check logs for details');
      previewLogger.logWebContainerError('Project status indicates build failure');
    } else if (!integrity.isComplete && integrity.hasValidFiles) {
      newState = 'fallback';
      setPreviewState('fallback');
      setLastError('Missing essential files (App.tsx or main.tsx)');
      
      // Enhanced logging
      const missingFiles = [];
      if (!integrity.hasApp) missingFiles.push('App.tsx');
      if (!integrity.hasMain) missingFiles.push('main.tsx');
      
      previewLogger.logScaffoldWarning(missingFiles);
      previewLogger.logFileIntegrityCheck(integrity);
      
      addLog({
        level: 'warn',
        source: 'Preview',
        message: `⚠️ Missing essential files - App: ${integrity.hasApp}, Main: ${integrity.hasMain}`,
        timestamp: Date.now(),
        id: `preview-${Date.now()}`
      });
    } else {
      newState = 'loading';
      setPreviewState('loading');
    }

    // Log state changes
    if (oldState !== newState) {
      previewLogger.logPreviewStateChange(oldState, newState, 
        project?.status ? `project status: ${project.status}` : undefined);
    }
  }, [project?.status, integrity.isComplete, integrity.hasValidFiles, integrity.hasApp, integrity.hasMain, addLog, previewState, preview.config.connectionStatus, preview.getPreviewUrl]);

  const handleRefresh = () => {
    setPreviewState('loading');
    setLastError(null);
    
    // Force re-check in a moment
    setTimeout(() => {
      const newIntegrity = checkAppIntegrity();
      if (newIntegrity.isComplete && project?.status === 'running') {
        setPreviewState('ready');
      } else {
        setPreviewState('fallback');
      }
    }, 500);

    addLog({
      level: 'info',
      source: 'Preview',
      message: '🔄 Preview manually refreshed',
      timestamp: Date.now(),
      id: `preview-refresh-${Date.now()}`
    });
  };

  const handleGenerateFallbackApp = async () => {
    setPreviewState('loading');
    
    try {
      await generateFallbackApp({
        appName: project?.name || 'NeuronForge App',
        includeTailwind: true,
        includeTypeScript: true
      });
      
      // Give a moment for files to be processed
      setTimeout(() => {
        const newIntegrity = checkAppIntegrity();
        if (newIntegrity.isComplete) {
          setPreviewState('ready');
          setLastError(null);
        } else {
          setPreviewState('fallback');
          setLastError('Generated files but still missing components');
        }
      }, 1000);
      
    } catch (error) {
      setPreviewState('error');
      setLastError(`Failed to generate fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConnectUrl = async () => {
    if (tempUrl.trim()) {
      setShowUrlInput(false);
      
      addLog({
        level: 'info',
        source: 'Preview',
        message: `🌐 Connecting to: ${tempUrl.trim()}`,
        timestamp: Date.now(),
        id: `preview-connect-${Date.now()}`
      });

      try {
        await preview.connectToUrl(tempUrl.trim());
        setTempUrl('');
        
        addLog({
          level: 'success',
          source: 'Preview',
          message: `✅ Connected to: ${tempUrl.trim()}`,
          timestamp: Date.now(),
          id: `preview-connected-${Date.now()}`
        });
      } catch (error) {
        addLog({
          level: 'error',
          source: 'Preview',
          message: `❌ Failed to connect to: ${tempUrl.trim()}`,
          timestamp: Date.now(),
          id: `preview-failed-${Date.now()}`
        });
      }
    }
  };

  const handleAutoDetect = async () => {
    setPreviewState('loading');
    
    addLog({
      level: 'info',
      source: 'Preview',
      message: '🔍 Auto-detecting local development server...',
      timestamp: Date.now(),
      id: `preview-autodetect-${Date.now()}`
    });

    const detectedUrl = await preview.autoDetectLocal();
    
    if (detectedUrl) {
      addLog({
        level: 'success',
        source: 'Preview',
        message: `✅ Detected server at: ${detectedUrl}`,
        timestamp: Date.now(),
        id: `preview-detected-${Date.now()}`
      });
    } else {
      addLog({
        level: 'warn',
        source: 'Preview',
        message: '⚠️ No local development servers detected',
        timestamp: Date.now(),
        id: `preview-nodetect-${Date.now()}`
      });
    }
  };

  const getStatusColor = () => {
    switch (previewState) {
      case 'ready': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'fallback': return 'bg-yellow-500';
      case 'no_server': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (previewState) {
      case 'ready': return 'Connected';
      case 'error': return 'Error';
      case 'fallback': return 'Fallback';
      case 'no_server': return 'No Server';
      case 'loading': return 'Loading';
      default: return 'Unknown';
    }
  };

  const renderPreviewContent = () => {
    switch (previewState) {
      case 'ready':
        return (
          <PreviewIframe 
            sandboxUrl={preview.getPreviewUrl()}
            autoRefresh={preview.config.autoRefresh}
            refreshInterval={preview.config.refreshInterval}
            className="w-full h-full"
          />
        );

      case 'no_server':
        return (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="text-center max-w-md">
              <div className="text-4xl text-orange-500 mb-4">🌐</div>
              <h3 className="text-lg font-medium text-orange-700 mb-2">No Development Server</h3>
              <p className="text-sm text-orange-600 mb-4">
                Connect to a running development server to see your live preview
              </p>
              
              {showUrlInput ? (
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      placeholder="http://localhost:3000"
                      className="flex-1 px-3 py-2 border border-orange-300 rounded text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleConnectUrl()}
                    />
                    <button
                      onClick={handleConnectUrl}
                      className="px-3 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                  <button
                    onClick={() => setShowUrlInput(false)}
                    className="text-xs text-orange-600 hover:text-orange-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={handleAutoDetect}
                    className="px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors block mx-auto"
                  >
                    🔍 Auto-Detect Server
                  </button>
                  <div className="flex space-x-2 justify-center">
                    <button 
                      onClick={() => preview.connectToLocalhost(3000)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      localhost:3000
                    </button>
                    <button 
                      onClick={() => preview.connectToLocalhost(5173)}
                      className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                    >
                      localhost:5173
                    </button>
                    <button 
                      onClick={() => setShowUrlInput(true)}
                      className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                    >
                      Custom URL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
            <div className="text-center max-w-md">
              <div className="text-4xl text-red-400 mb-4">❌</div>
              <h3 className="text-lg font-medium text-red-700 mb-2">Preview Error</h3>
              <p className="text-sm text-red-600 mb-4">
                {lastError || 'Something went wrong with the preview'}
              </p>
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        );

      case 'fallback':
        return (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
            <div className="text-center max-w-md">
              <div className="text-4xl text-yellow-500 mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-yellow-700 mb-2">Missing Entry Files</h3>
              <p className="text-sm text-yellow-600 mb-2">
                {lastError || 'No renderable entry point found'}
              </p>
              <div className="text-xs text-yellow-600 mb-4">
                Files: {integrity.fileCount} | App: {integrity.hasApp ? '✅' : '❌'} | Main: {integrity.hasMain ? '✅' : '❌'}
              </div>
              <div className="space-y-2">
                <button 
                  onClick={handleGenerateFallbackApp}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors block mx-auto"
                >
                  Generate Entry Files
                </button>
                <button 
                  onClick={handleRefresh}
                  className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        );

      default: // loading
        return (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <div className="text-4xl text-blue-400 mb-4 animate-pulse">🚀</div>
              <h3 className="text-lg font-medium text-blue-700 mb-2">Preview Loading</h3>
              <p className="text-sm text-blue-600">
                {integrity.fileCount > 0 
                  ? `Analyzing ${integrity.fileCount} files...`
                  : 'Waiting for AI agents to generate files...'
                }
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-3 justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-300">Live Preview</span>
          {preview.getPreviewUrl() && (
            <span className="text-xs text-gray-500 truncate max-w-32">
              {preview.getPreviewUrl()}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">{getStatusText()}</span>
          {preview.getPreviewUrl() && (
            <button 
              onClick={handleRefresh}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              title="Refresh preview"
            >
              🔄
            </button>
          )}
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            title="Configure preview URL"
          >
            ⚙️
          </button>
          <div 
            className={`w-2 h-2 rounded-full ${getStatusColor()}`}
            title={`Preview status: ${getStatusText()}`}
          />
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-white m-2 rounded border border-gray-700 overflow-hidden">
        {renderPreviewContent()}
      </div>
    </div>
  );
};

export default LivePreview;