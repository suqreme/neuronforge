import React, { useEffect } from 'react';
import { PromptPanel } from './PromptPanel';
import { FlowCanvas } from './FlowCanvas';
import { useAPIKeysStore } from '../../stores/apiKeysStore';
import { ErrorBoundary } from '../ErrorBoundary';

export const CanvasLayout: React.FC = () => {
  const { loadFromEnv } = useAPIKeysStore();

  useEffect(() => {
    // Try to load API keys from environment on app startup
    loadFromEnv();
  }, [loadFromEnv]);
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🧠</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">NeuronForge</h1>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm text-gray-500">Visual AI Development Platform</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
              Templates
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
              Export
            </button>
            <button className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors">
              Save Project
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Prompt & Controls */}
        <div className="w-80 bg-white border-r border-gray-200 shadow-sm">
          <PromptPanel />
        </div>

        {/* Right Panel - Canvas */}
        <div className="flex-1 bg-gray-50">
          <ErrorBoundary>
            <FlowCanvas />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};