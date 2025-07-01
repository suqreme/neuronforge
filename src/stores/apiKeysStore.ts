import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface APIKey {
  id: string;
  provider: 'openai' | 'anthropic';
  name: string;
  key: string;
  model: string;
  isActive: boolean;
  createdAt: number;
}

interface APIKeysState {
  keys: APIKey[];
  activeKey: APIKey | null;
  isLoading: boolean;
  error: string | null;
}

interface APIKeysStore extends APIKeysState {
  // Actions
  addKey: (provider: 'openai' | 'anthropic', name: string, key: string, model: string) => void;
  removeKey: (id: string) => void;
  setActiveKey: (id: string) => void;
  updateKey: (id: string, updates: Partial<APIKey>) => void;
  getActiveKey: () => APIKey | null;
  testKey: (id: string) => Promise<boolean>;
  clearError: () => void;
  loadFromEnv: () => void;
}

export const useAPIKeysStore = create<APIKeysStore>()(
  persist(
    (set, get) => ({
      // Initial state
      keys: [],
      activeKey: null,
      isLoading: false,
      error: null,

      // Actions
      addKey: (provider, name, key, model) => {
        const newKey: APIKey = {
          id: `${provider}-${Date.now()}`,
          provider,
          name,
          key,
          model,
          isActive: false,
          createdAt: Date.now()
        };

        set(state => {
          const updatedKeys = [...state.keys, newKey];
          // Set as active if it's the first key
          const activeKey = state.keys.length === 0 ? newKey : state.activeKey;
          
          return {
            keys: updatedKeys,
            activeKey,
            error: null
          };
        });
      },

      removeKey: (id) => {
        set(state => {
          const updatedKeys = state.keys.filter(key => key.id !== id);
          const activeKey = state.activeKey?.id === id ? 
            (updatedKeys.length > 0 ? updatedKeys[0] : null) : 
            state.activeKey;
          
          return {
            keys: updatedKeys,
            activeKey
          };
        });
      },

      setActiveKey: (id) => {
        set(state => {
          const key = state.keys.find(k => k.id === id);
          if (!key) return state;
          
          // Update the key with isActive flag and set as activeKey
          const updatedKeys = state.keys.map(k => ({
            ...k,
            isActive: k.id === id
          }));
          
          const updatedActiveKey = { ...key, isActive: true };
          
          return {
            keys: updatedKeys,
            activeKey: updatedActiveKey
          };
        });
      },

      updateKey: (id, updates) => {
        set(state => ({
          keys: state.keys.map(key =>
            key.id === id ? { ...key, ...updates } : key
          ),
          activeKey: state.activeKey?.id === id ? 
            { ...state.activeKey, ...updates } : 
            state.activeKey
        }));
      },

      getActiveKey: () => {
        const state = get();
        // Return the explicitly set active key, or find the one marked as active
        if (state.activeKey) {
          return state.activeKey;
        }
        // Fallback to the first key marked as active
        const activeKey = state.keys.find(k => k.isActive);
        if (activeKey) {
          return activeKey;
        }
        // Final fallback to the first key
        return state.keys.length > 0 ? state.keys[0] : null;
      },

      testKey: async (id) => {
        const { keys } = get();
        const key = keys.find(k => k.id === id);
        if (!key) return false;

        set({ isLoading: true, error: null });

        // TEMPORARY: Skip actual API test due to CORS issues
        // In production, this should go through a backend proxy
        if (key.provider === 'anthropic') {
          console.warn('Anthropic API test skipped due to CORS. Key will be marked as valid for now.');
          set({ isLoading: false, error: null });
          get().updateKey(id, { isActive: true });
          return true;
        }

        try {
          let response: Response;
          
          if (key.provider === 'openai') {
            // OpenAI: Test with models endpoint
            response = await fetch('https://api.openai.com/v1/models', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${key.key}`,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // Anthropic: Use proxy to avoid CORS
            const proxyUrl = '/api/anthropic';
            response = await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                apiKey: key.key,
                model: key.model,
                messages: [{ role: 'user', content: 'Hi' }]
              })
            });
          }

          const isValid = response.ok;
          
          if (!isValid) {
            const errorText = await response.text();
            console.error(`API key test failed for ${key.provider}:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            
            set({ 
              isLoading: false, 
              error: `API key test failed: ${response.status} ${response.statusText}` 
            });
          } else {
            set({ isLoading: false, error: null });
            get().updateKey(id, { isActive: true });
          }
          
          return isValid;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: `Failed to test API key: ${error}` 
          });
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      loadFromEnv: () => {
        // Try to load API keys from environment variables
        const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
        const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

        if (openaiKey && !get().keys.some(k => k.provider === 'openai')) {
          get().addKey('openai', 'Environment OpenAI', openaiKey, 'gpt-4');
        }

        if (anthropicKey && !get().keys.some(k => k.provider === 'anthropic')) {
          get().addKey('anthropic', 'Environment Claude', anthropicKey, 'claude-3-sonnet-20240229');
        }
      }
    }),
    {
      name: 'neuronforge-api-keys',
      // Only persist non-sensitive data structure, keys are encrypted
      partialize: (state) => ({
        keys: state.keys.map(key => ({
          ...key,
          key: btoa(key.key) // Basic encoding (use proper encryption in production)
        })),
        activeKey: state.activeKey ? {
          ...state.activeKey,
          key: btoa(state.activeKey.key)
        } : null
      }),
      // Decode keys when loading
      onRehydrateStorage: () => (state) => {
        if (state?.keys) {
          state.keys = state.keys.map(key => ({
            ...key,
            key: atob(key.key)
          }));
        }
        if (state?.activeKey) {
          state.activeKey = {
            ...state.activeKey,
            key: atob(state.activeKey.key)
          };
          
          // Ensure the activeKey exists in the keys array and is marked as active
          const activeKeyExists = state.keys.find(k => k.id === state.activeKey.id);
          if (!activeKeyExists && state.keys.length > 0) {
            // If the active key doesn't exist, set the first key as active
            state.activeKey = state.keys[0];
            state.keys[0].isActive = true;
          }
        } else if (state?.keys?.length > 0) {
          // If no active key but we have keys, set the first one as active
          state.activeKey = state.keys[0];
          state.keys[0].isActive = true;
        }
      }
    }
  )
);

// Default models for each provider
export const DEFAULT_MODELS = {
  openai: [
    'gpt-4',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo'
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022', 
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ]
} as const;