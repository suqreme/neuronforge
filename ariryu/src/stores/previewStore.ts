import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PreviewConfig {
  sandboxUrl: string;
  autoRefresh: boolean;
  refreshInterval: number;
  enableHotReload: boolean;
  lastConnected: number | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface PreviewState {
  config: PreviewConfig;
  isPreviewVisible: boolean;
  
  // Actions
  setSandboxUrl: (url: string) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setConnectionStatus: (status: PreviewConfig['connectionStatus']) => void;
  togglePreview: () => void;
  showPreview: () => void;
  hidePreview: () => void;
  updateConfig: (config: Partial<PreviewConfig>) => void;
  
  // Utilities
  getPreviewUrl: () => string;
  isPreviewAvailable: () => boolean;
  getConnectionStatusText: () => string;
}

const defaultConfig: PreviewConfig = {
  sandboxUrl: '',
  autoRefresh: false,
  refreshInterval: 5000,
  enableHotReload: true,
  lastConnected: null,
  connectionStatus: 'disconnected'
};

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      isPreviewVisible: false,

      setSandboxUrl: (url: string) => {
        set((state) => ({
          config: {
            ...state.config,
            sandboxUrl: url,
            lastConnected: url ? Date.now() : null,
            connectionStatus: url ? 'connecting' : 'disconnected'
          }
        }));
      },

      setAutoRefresh: (enabled: boolean) => {
        set((state) => ({
          config: {
            ...state.config,
            autoRefresh: enabled
          }
        }));
      },

      setRefreshInterval: (interval: number) => {
        set((state) => ({
          config: {
            ...state.config,
            refreshInterval: Math.max(1000, interval) // Minimum 1 second
          }
        }));
      },

      setConnectionStatus: (status: PreviewConfig['connectionStatus']) => {
        set((state) => ({
          config: {
            ...state.config,
            connectionStatus: status,
            lastConnected: status === 'connected' ? Date.now() : state.config.lastConnected
          }
        }));
      },

      togglePreview: () => {
        set((state) => ({
          isPreviewVisible: !state.isPreviewVisible
        }));
      },

      showPreview: () => {
        set({ isPreviewVisible: true });
      },

      hidePreview: () => {
        set({ isPreviewVisible: false });
      },

      updateConfig: (newConfig: Partial<PreviewConfig>) => {
        set((state) => ({
          config: {
            ...state.config,
            ...newConfig
          }
        }));
      },

      getPreviewUrl: () => {
        const { config } = get();
        return config.sandboxUrl;
      },

      isPreviewAvailable: () => {
        const { config } = get();
        return Boolean(config.sandboxUrl && config.connectionStatus !== 'error');
      },

      getConnectionStatusText: () => {
        const { config } = get();
        switch (config.connectionStatus) {
          case 'connected':
            return 'Connected';
          case 'connecting':
            return 'Connecting...';
          case 'error':
            return 'Connection Error';
          case 'disconnected':
          default:
            return 'Disconnected';
        }
      }
    }),
    {
      name: 'preview-store',
      partialize: (state) => ({
        config: {
          ...state.config,
          connectionStatus: 'disconnected' // Reset connection status on reload
        }
      })
    }
  )
);

// Utility functions for common preview URLs
export const PreviewUrlPresets = {
  localhost: (port: number = 3000) => `http://localhost:${port}`,
  modal: (appId: string) => `https://modal-app-${appId}.modal.run`,
  vercel: (deploymentUrl: string) => `https://${deploymentUrl}.vercel.app`,
  netlify: (siteId: string) => `https://${siteId}.netlify.app`,
  
  // Auto-detect common development servers
  detectLocal: async (): Promise<string | null> => {
    const commonPorts = [3000, 3001, 5173, 8080, 4000, 4200, 8000];
    
    for (const port of commonPorts) {
      try {
        const url = `http://localhost:${port}`;
        
        // Use a more reliable detection method
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(url, { 
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        // If we get here without an error, the server is likely running
        return url;
      } catch (error) {
        // Only log if it's not a typical "connection refused" error
        if (error instanceof Error && !error.message.includes('Failed to fetch')) {
          console.debug(`Port ${port} check failed:`, error.message);
        }
        // Continue to next port
      }
    }
    
    return null;
  }
};

// Hook for easier access to preview functionality
export const usePreview = () => {
  const store = usePreviewStore();
  
  return {
    ...store,
    
    // Convenience methods
    connectToLocalhost: (port: number = 3000) => {
      store.setSandboxUrl(PreviewUrlPresets.localhost(port));
    },
    
    connectToModal: (appId: string) => {
      store.setSandboxUrl(PreviewUrlPresets.modal(appId));
    },
    
    connectToUrl: async (url: string) => {
      // Validate URL format
      try {
        const validUrl = new URL(url);
        
        // Additional validation for common issues
        if (!['http:', 'https:'].includes(validUrl.protocol)) {
          throw new Error('URL must use http or https protocol');
        }
        
        store.setConnectionStatus('connecting');
        store.setSandboxUrl(url);
        
        // Test the connection
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          await fetch(url, { 
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-cache'
          });
          
          clearTimeout(timeoutId);
          store.setConnectionStatus('connected');
        } catch (fetchError) {
          console.warn('Preview URL connection test failed:', fetchError);
          store.setConnectionStatus('error');
        }
        
      } catch (error) {
        console.error('Invalid URL provided to preview store:', url, error);
        store.setConnectionStatus('error');
      }
    },
    
    autoDetectLocal: async () => {
      store.setConnectionStatus('connecting');
      const detectedUrl = await PreviewUrlPresets.detectLocal();
      
      if (detectedUrl) {
        store.setSandboxUrl(detectedUrl);
        store.setConnectionStatus('connected');
        return detectedUrl;
      } else {
        store.setConnectionStatus('error');
        return null;
      }
    }
  };
};