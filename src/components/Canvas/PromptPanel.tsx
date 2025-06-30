import React, { useState } from 'react';
import { useNodesStore } from '../../stores/nodesStore';
import { useAPIKeysStore } from '../../stores/apiKeysStore';
import { APIKeySettings } from '../Settings/APIKeySettings';

export const PromptPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { processPrompt, nodes, managerId } = useNodesStore();
  const { getActiveKey } = useAPIKeysStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;
    
    setIsProcessing(true);
    
    // Process prompt through manager
    try {
      processPrompt(prompt);
      
      // Clear prompt after successful processing
      setTimeout(() => {
        setPrompt('');
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Error processing prompt:', error);
      setIsProcessing(false);
    }
  };

  const examplePrompts = [
    "Build a notes app with rich text editing",
    "Create a chat app with real-time messaging", 
    "Make a task management system",
    "Build an e-commerce store with products",
    "Create an analytics dashboard with charts"
  ];

  // Get current stats
  const activeAgents = nodes.filter(n => n.type !== 'default').length;
  const managerNode = managerId ? nodes.find(n => n.id === managerId) : null;
  const hasManager = !!managerNode;

  const activeApiKey = getActiveKey();

  if (showSettings) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">⚙️ Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
          >
            ← Back
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <APIKeySettings />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Project Prompt</h2>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            title="API Settings"
          >
            ⚙️
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Describe your app idea and watch AI agents collaborate to build it.
        </p>
        
        {/* API Key Status */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {activeApiKey ? (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded">
                ✅ {activeApiKey.provider === 'openai' ? 'OpenAI' : 'Claude'} ({activeApiKey.model})
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
                ⚠️ No API Key - Using Templates
              </span>
            )}
          </div>
          {activeApiKey && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-blue-600 hover:text-blue-800 underline"
              title="Switch API provider or model"
            >
              Switch Provider
            </button>
          )}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="p-4 flex-1 flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to build?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Build a task management app with drag-and-drop, user authentication, and real-time collaboration..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
              disabled={isProcessing}
            />
          </div>
          
          <button
            type="submit"
            disabled={!prompt.trim() || isProcessing}
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Spawning Agents...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Start Building</span>
              </>
            )}
          </button>
        </form>

        {/* Example Prompts */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Try these examples:</h3>
          <div className="space-y-2">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => setPrompt(example)}
                className="w-full text-left p-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                disabled={isProcessing}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Panel */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Agents: {activeAgents} active</span>
          <span>Status: {hasManager ? 'Manager Ready' : 'Ready'}</span>
        </div>
        <div className="mt-2 flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isProcessing ? 'bg-yellow-500 animate-pulse' : 
            hasManager ? 'bg-blue-500' : 'bg-green-500'
          }`}></div>
          <span className="text-xs text-gray-600">
            {isProcessing ? 'Processing prompt...' :
             hasManager ? 'Manager coordinating agents' :
             'System ready for new project'}
          </span>
        </div>
        
        {/* Manager Status */}
        {managerNode && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <div className="text-xs font-medium text-blue-800">Manager Status</div>
            <div className="text-xs text-blue-700 mt-1">
              {managerNode.data.description || 'Coordinating agents'}
            </div>
            {managerNode.data.progress !== undefined && (
              <div className="mt-1 bg-blue-200 rounded-full h-1">
                <div 
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${managerNode.data.progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};