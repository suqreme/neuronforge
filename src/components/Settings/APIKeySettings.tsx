import React, { useState, useEffect } from 'react';
import { useAPIKeysStore, APIKey, DEFAULT_MODELS } from '../../stores/apiKeysStore';

export const APIKeySettings: React.FC = () => {
  const { 
    keys, 
    activeKey, 
    isLoading, 
    error, 
    addKey, 
    removeKey, 
    setActiveKey, 
    testKey, 
    clearError,
    loadFromEnv 
  } = useAPIKeysStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState({
    provider: 'openai' as 'openai' | 'anthropic',
    name: '',
    key: '',
    model: 'gpt-4'
  });

  useEffect(() => {
    // Try to load keys from environment on mount
    loadFromEnv();
  }, [loadFromEnv]);

  const handleAddKey = () => {
    if (!newKey.name || !newKey.key) return;
    
    addKey(newKey.provider, newKey.name, newKey.key, newKey.model);
    setNewKey({
      provider: 'openai',
      name: '',
      key: '',
      model: 'gpt-4'
    });
    setShowAddForm(false);
  };

  const handleTestKey = async (keyId: string) => {
    const isValid = await testKey(keyId);
    if (isValid) {
      alert('API key is valid! ✅');
    } else {
      alert('API key test failed. Please check your key. ❌');
    }
  };

  const maskKey = (key: string) => {
    if (key.length < 8) return key;
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">🔑 AI API Configuration</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          + Add API Key
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={clearError} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-lg font-medium mb-2">No API Keys Configured</h3>
          <p className="text-sm">
            Add an OpenAI or Anthropic API key to enable AI-powered code generation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div 
              key={key.id} 
              className={`p-4 border rounded-lg transition-colors ${
                activeKey?.id === key.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {key.provider === 'openai' ? '🟢' : '🟣'}
                    </span>
                    <h3 className="font-medium text-gray-800">{key.name}</h3>
                    {activeKey?.id === key.id && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="capitalize">{key.provider}</span> • {key.model}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 font-mono">
                    {maskKey(key.key)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {activeKey?.id !== key.id && (
                    <button
                      onClick={() => setActiveKey(key.id)}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleTestKey(key.id)}
                    disabled={isLoading}
                    className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors disabled:opacity-50"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => removeKey(key.id)}
                    className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="font-medium text-gray-800 mb-4">Add New API Key</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="api-provider" className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <select
                id="api-provider"
                value={newKey.provider}
                onChange={(e) => setNewKey(prev => ({
                  ...prev,
                  provider: e.target.value as 'openai' | 'anthropic',
                  model: e.target.value === 'openai' ? 'gpt-4' : 'claude-3-5-sonnet-20241022'
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label htmlFor="api-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name (for reference)
              </label>
              <input
                id="api-name"
                type="text"
                value={newKey.name}
                onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., My OpenAI Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                id="api-key"
                type="password"
                value={newKey.key}
                onChange={(e) => setNewKey(prev => ({ ...prev, key: e.target.value }))}
                placeholder={newKey.provider === 'openai' ? 'sk-...' : 'sk-ant-api03-...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="api-model" className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                id="api-model"
                value={newKey.model}
                onChange={(e) => setNewKey(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DEFAULT_MODELS[newKey.provider].map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAddKey}
                disabled={!newKey.name || !newKey.key}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Key
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">💡 How to get API keys:</h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• <strong>OpenAI:</strong> Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a>
            <br /><span className="text-xs text-blue-600">Format: sk-proj-... or sk-...</span>
          </li>
          <li>• <strong>Anthropic:</strong> Visit <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a>
            <br /><span className="text-xs text-blue-600">Format: sk-ant-api03-...</span>
          </li>
        </ul>
        <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
          <strong>Note:</strong> Make sure your Anthropic API key has the correct format and sufficient credits/usage allowance.
        </div>
        <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
          <strong>⚠️ Development Notice:</strong> Due to CORS restrictions, Anthropic API testing is currently bypassed. 
          The key will be validated during actual usage. For production, API calls should go through a backend proxy.
        </div>
      </div>
    </div>
  );
};