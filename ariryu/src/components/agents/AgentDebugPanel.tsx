import React from 'react';
import { useAgentStore } from '../../stores/agentStore';

interface AgentDebugPanelProps {
  agentId: string;
}

export default function AgentDebugPanel({ agentId }: AgentDebugPanelProps) {
  const agentDebugInfo = useAgentStore((state) => state.agentDebugInfo[agentId]);

  if (!agentDebugInfo) {
    return (
      <div className="p-4 bg-neutral-900 border border-neutral-700 rounded-lg">
        <div className="text-red-400">Agent not found: {agentId}</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getProgressBar = (progress: number) => {
    return (
      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    );
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-700 rounded-lg">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          🧠 {agentDebugInfo.name}
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-medium ${getStatusColor(agentDebugInfo.status)}`}>
            Status: {agentDebugInfo.status}
          </span>
          <span className="text-gray-500">•</span>
          <span className="text-blue-400">
            Progress: {agentDebugInfo.progress}%
          </span>
        </div>
        {getProgressBar(agentDebugInfo.progress)}
      </div>

      {/* Task */}
      {agentDebugInfo.task && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-white mb-1">📋 Current Task</h4>
          <div className="text-sm text-gray-300 bg-neutral-800 p-2 rounded">
            {agentDebugInfo.task}
          </div>
        </div>
      )}

      {/* Thoughts */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-white mb-1">💭 Current Thoughts</h4>
        <div className="text-sm text-green-300 bg-neutral-800 p-2 rounded whitespace-pre-wrap">
          {agentDebugInfo.thoughts || "🤔 No active thoughts"}
        </div>
      </div>

      {/* Memory Snapshot */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-white mb-1">🧠 Memory Snapshot</h4>
        <div className="max-h-32 overflow-y-auto">
          <pre className="bg-neutral-800 p-2 rounded text-xs text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(agentDebugInfo.memory || {}, null, 2)}
          </pre>
        </div>
      </div>

      {/* Logs */}
      <div className="mb-3">
        <h4 className="text-sm font-bold text-white mb-1">📝 Activity Logs</h4>
        <div className="max-h-48 overflow-y-auto text-xs bg-neutral-800 p-2 rounded">
          {agentDebugInfo.logs.length > 0 ? (
            <div className="space-y-1">
              {agentDebugInfo.logs.slice(-10).map((log, idx) => (
                <div key={idx} className="text-orange-300 font-mono">
                  {log}
                </div>
              ))}
              {agentDebugInfo.logs.length > 10 && (
                <div className="text-gray-500 text-center py-1">
                  ... and {agentDebugInfo.logs.length - 10} more entries
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No logs available</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
        Last Updated: {new Date(agentDebugInfo.updatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}