import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLogStore } from '../../stores/logStore';
import { generateFallbackApp } from '../../utils/fallbackGenerator';
import { previewLogger } from '../../utils/previewLogger';

const LivePreview: React.FC = () => {
  const { project } = useProjectStore();
  const { openTabs } = useEditorStore();
  const addLog = useLogStore((state) => state.addLog);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error' | 'fallback'>('loading');
  const [previewUrl, setPreviewUrl] = useState<string>('about:blank');
  const [lastError, setLastError] = useState<string | null>(null);

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

  // Monitor file changes and project status
  useEffect(() => {
    const oldState = previewState;
    let newState = previewState;
    
    if (project?.status === 'running' && integrity.isComplete) {
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
  }, [project?.status, integrity.isComplete, integrity.hasValidFiles, integrity.hasApp, integrity.hasMain, addLog, previewState]);

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

  const getStatusColor = () => {
    switch (previewState) {
      case 'ready': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'fallback': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (previewState) {
      case 'ready': return 'Ready';
      case 'error': return 'Error';
      case 'fallback': return 'Fallback';
      case 'loading': return 'Loading';
      default: return 'Unknown';
    }
  };

  const renderPreviewContent = () => {
    switch (previewState) {
      case 'ready':
        return (
          <iframe 
            src={previewUrl}
            className="w-full h-full border-0"
            title="Live Preview"
            onError={() => {
              setPreviewState('error');
              setLastError('Preview iframe failed to load');
            }}
          />
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
        <span className="text-sm text-gray-300">Live Preview</span>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">{getStatusText()}</span>
          <button 
            onClick={handleRefresh}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            title="Refresh preview"
          >
            🔄
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