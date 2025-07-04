import React from 'react';
import { useAgentStore } from '../../stores/agentStore';

export default function AgentGraphView() {
  const agents = useAgentStore((state) => state.agents);
  const agentDebugInfo = useAgentStore((state) => state.agentDebugInfo);
  const messages = useAgentStore((state) => state.messages);

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'manager':
        return '👨‍💼';
      case 'ui':
        return '🎨';
      case 'backend':
        return '⚙️';
      case 'llm':
        return '🤖';
      case 'deploy':
        return '🚀';
      case 'memory':
        return '🧠';
      case 'log':
        return '📝';
      default:
        return '🔧';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'border-yellow-400 bg-yellow-900/20';
      case 'completed':
        return 'border-green-400 bg-green-900/20';
      case 'error':
        return 'border-red-400 bg-red-900/20';
      default:
        return 'border-gray-600 bg-slate-800';
    }
  };

  const getRecentMessages = () => {
    return messages.slice(-5).reverse();
  };

  return (
    <div className="p-4">
      <h3 className="text-white text-lg font-bold mb-4">🕸️ Agent Task Graph</h3>
      
      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {agents.map((agent) => {
          const debugInfo = agentDebugInfo[agent.id];
          return (
            <div
              key={agent.id}
              className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${getStatusColor(agent.status)}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getAgentIcon(agent.type)}</span>
                <div>
                  <div className="font-bold text-white">{agent.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{agent.type}</div>
                </div>
              </div>
              
              {debugInfo?.task && (
                <div className="text-xs text-gray-300 mb-2">
                  📋 {debugInfo.task}
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${
                  agent.status === 'running' ? 'text-yellow-400' : 
                  agent.status === 'completed' ? 'text-green-400' :
                  agent.status === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {agent.status}
                </span>
                <span className="text-blue-400">
                  {agent.progress || 0}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, agent.progress || 0))}%` }}
                />
              </div>
              
              {/* Recent thoughts */}
              {debugInfo?.thoughts && (
                <div className="mt-2 text-xs text-green-300 truncate">
                  💭 {debugInfo.thoughts}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agent Communication Flow */}
      <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-700">
        <h4 className="text-white font-bold mb-3">📡 Recent Agent Communications</h4>
        
        {getRecentMessages().length > 0 ? (
          <div className="space-y-2">
            {getRecentMessages().map((message, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-blue-400 font-mono">{message.from}</span>
                <span className="text-gray-500">→</span>
                <span className="text-green-400 font-mono">{message.to}</span>
                <span className="text-gray-500">:</span>
                <span className="text-orange-300">{message.type}</span>
                {message.payload && (
                  <span className="text-xs text-gray-400 truncate max-w-32">
                    {typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No recent communications</div>
        )}
      </div>

      {/* Workflow Diagram */}
      <div className="mt-6 bg-neutral-900 rounded-lg p-4 border border-neutral-700">
        <h4 className="text-white font-bold mb-3">🔄 Agent Workflow</h4>
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👨‍💼</span>
            <span className="text-white">Manager</span>
          </div>
          <span className="text-gray-500">→</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <span className="text-white">UI Agent</span>
          </div>
          <span className="text-gray-500">→</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <span className="text-white">Backend</span>
          </div>
          <span className="text-gray-500">→</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="text-white">Deploy</span>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          Typical agent execution flow for project development
        </div>
      </div>
    </div>
  );
}