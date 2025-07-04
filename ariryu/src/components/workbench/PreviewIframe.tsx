import React, { useState, useEffect, useRef } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus } from '../../stores/messageBus';

interface PreviewIframeProps {
  sandboxUrl: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export const PreviewIframe: React.FC<PreviewIframeProps> = ({ 
  sandboxUrl, 
  autoRefresh = false,
  refreshInterval = 5000,
  className = ''
}) => {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sandboxUrl) {
      const urlWithCacheBuster = `${sandboxUrl}?t=${Date.now()}`;
      setCurrentUrl(urlWithCacheBuster);
      setIsLoading(true);
      setHasError(false);
      
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Live Preview',
        message: `🌐 Loading preview from: ${sandboxUrl}`
      });
    }
  }, [sandboxUrl]);

  useEffect(() => {
    if (autoRefresh && sandboxUrl) {
      refreshTimeoutRef.current = setTimeout(() => {
        refreshPreview();
      }, refreshInterval);

      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, lastRefresh, sandboxUrl]);

  const refreshPreview = () => {
    if (sandboxUrl) {
      const newUrl = `${sandboxUrl}?t=${Date.now()}`;
      setCurrentUrl(newUrl);
      setLastRefresh(Date.now());
      setIsLoading(true);
      setHasError(false);
      
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Live Preview',
        message: '🔄 Refreshing preview...'
      });

      useMessageBus.getState().sendMessage({
        sender: 'LIVE_PREVIEW',
        receiver: 'ALL',
        type: 'context',
        content: 'Preview refreshed',
        priority: 'low',
        metadata: {
          tags: ['preview', 'refresh'],
          url: sandboxUrl,
          timestamp: Date.now()
        }
      });
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    
    useLogStore.getState().addLog({
      level: 'success',
      source: 'Live Preview',
      message: '✅ Preview loaded successfully'
    });
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Live Preview',
      message: `❌ Failed to load preview from: ${sandboxUrl}`
    });

    useMessageBus.getState().sendMessage({
      sender: 'LIVE_PREVIEW',
      receiver: 'ALL',
      type: 'error',
      content: `Preview failed to load: ${sandboxUrl}`,
      priority: 'medium',
      metadata: {
        tags: ['preview', 'error'],
        url: sandboxUrl,
        error: 'Failed to load iframe'
      }
    });
  };

  const openInNewTab = () => {
    if (sandboxUrl) {
      window.open(sandboxUrl, '_blank', 'noopener,noreferrer');
      
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Live Preview',
        message: '🔗 Opened preview in new tab'
      });
    }
  };

  if (!sandboxUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-900 text-gray-400 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-4">🌐</div>
          <div className="text-lg mb-2">No Preview Available</div>
          <div className="text-sm">
            Start a development server to see your app preview
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-900 text-gray-400 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg mb-2">Preview Error</div>
          <div className="text-sm mb-4">
            Failed to load: {sandboxUrl}
          </div>
          <div className="space-x-2">
            <button
              onClick={refreshPreview}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              🔄 Retry
            </button>
            <button
              onClick={openInNewTab}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              🔗 Open in New Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full bg-gray-900 ${className}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
          <div className="text-center text-white">
            <div className="animate-spin text-3xl mb-2">⚙️</div>
            <div>Loading preview...</div>
          </div>
        </div>
      )}

      {/* Preview Controls */}
      <div className="absolute top-2 right-2 z-20 flex space-x-1">
        <button
          onClick={refreshPreview}
          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded border border-gray-600 transition-colors"
          title="Refresh preview"
        >
          🔄
        </button>
        <button
          onClick={openInNewTab}
          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded border border-gray-600 transition-colors"
          title="Open in new tab"
        >
          🔗
        </button>
      </div>

      {/* Preview URL Display */}
      <div className="absolute top-2 left-2 z-20">
        <div className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded border border-gray-600">
          {sandboxUrl}
        </div>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={currentUrl}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        className="w-full h-full border-none"
        title="Live App Preview"
        loading="lazy"
      />
    </div>
  );
};

export default PreviewIframe;