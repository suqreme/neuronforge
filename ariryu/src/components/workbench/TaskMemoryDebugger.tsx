import React, { useState, useEffect } from 'react';
import { useTaskMemoryStore, TaskMemoryEntry, TaskSession } from '../../stores/taskMemoryStore';

export function TaskMemoryDebugger() {
  const { 
    entries, 
    sessions, 
    getCurrentSession, 
    getAgentMemory, 
    getTaskStats,
    clearTaskMemory,
    startSession,
    endSession 
  } = useTaskMemoryStore();

  const [selectedAgent, setSelectedAgent] = useState<string>('CLAUDE');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [showSessions, setShowSessions] = useState(true);
  const [showMemories, setShowMemories] = useState(true);
  const [showStats, setShowStats] = useState(false);

  const currentSession = getCurrentSession();
  const agentMemories = getAgentMemory(selectedAgent, 20);
  const stats = getTaskStats(selectedAgent);

  // Get unique agents from entries
  const agents = Array.from(new Set(entries.map(entry => entry.agent)));

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'completed': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      case 'paused': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task_start': return '🚀';
      case 'task_progress': return '⚡';
      case 'task_complete': return '✅';
      case 'file_generation': return '📄';
      case 'critique': return '🔍';
      case 'error': return '❌';
      case 'planning': return '🧠';
      default: return '📋';
    }
  };

  const handleStartSession = () => {
    const objective = prompt('Enter session objective:');
    if (objective) {
      startSession(selectedAgent, objective);
    }
  };

  const handleEndSession = () => {
    if (currentSession && confirm('End current session?')) {
      endSession();
    }
  };

  return (
    <div className="h-full flex flex-col bg-black text-green-400 font-mono text-sm">
      {/* Header */}
      <div className="p-3 border-b border-green-700 bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-green-300 flex items-center gap-2">
            🧠 Task Memory Debugger
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className={`px-2 py-1 rounded ${showSessions ? 'bg-green-700' : 'bg-gray-700'}`}
            >
              Sessions
            </button>
            <button
              onClick={() => setShowMemories(!showMemories)}
              className={`px-2 py-1 rounded ${showMemories ? 'bg-green-700' : 'bg-gray-700'}`}
            >
              Memory
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={`px-2 py-1 rounded ${showStats ? 'bg-green-700' : 'bg-gray-700'}`}
            >
              Stats
            </button>
            <button
              onClick={() => confirm('Clear all task memory?') && clearTaskMemory()}
              className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Agent Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span>Agent:</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-gray-800 border border-green-700 rounded px-2 py-1 text-green-400"
          >
            {agents.map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
          
          {currentSession && currentSession.agent === selectedAgent && (
            <span className="text-green-300">
              • Session Active: {currentSession.objective.substring(0, 30)}...
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        
        {/* Current Session Controls */}
        {showSessions && (
          <div className="border border-green-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-300">Session Management</h3>
              <div className="flex gap-2">
                {!currentSession ? (
                  <button
                    onClick={handleStartSession}
                    className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
                  >
                    Start Session
                  </button>
                ) : (
                  <button
                    onClick={handleEndSession}
                    className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
                  >
                    End Session
                  </button>
                )}
              </div>
            </div>

            {currentSession ? (
              <div className="text-xs space-y-1">
                <div><span className="text-green-300">Objective:</span> {currentSession.objective}</div>
                <div><span className="text-green-300">Agent:</span> {currentSession.agent}</div>
                <div><span className="text-green-300">Started:</span> {formatTimestamp(currentSession.startTime)}</div>
                <div><span className="text-green-300">Tasks:</span> {currentSession.taskCount}</div>
                <div><span className="text-green-300">Status:</span> <span className={getStatusColor(currentSession.status)}>{currentSession.status}</span></div>
              </div>
            ) : (
              <div className="text-gray-500 text-xs">No active session</div>
            )}

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div className="mt-3">
                <h4 className="text-green-300 text-xs font-medium mb-1">Recent Sessions</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {sessions.slice(-5).reverse().map(session => (
                    <div key={session.id} className="text-xs p-2 bg-gray-800 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-green-200">{session.objective.substring(0, 40)}...</div>
                          <div className="text-gray-400">{session.agent} • {formatTimestamp(session.startTime)}</div>
                        </div>
                        <span className={`${getStatusColor(session.status)} text-xs`}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div className="border border-green-700 rounded p-3">
            <h3 className="font-semibold text-green-300 mb-2">Statistics ({selectedAgent})</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Total Tasks: <span className="text-green-200">{stats.totalTasks}</span></div>
              <div>Completed: <span className="text-blue-400">{stats.completedTasks}</span></div>
              <div>Active: <span className="text-green-400">{stats.activeTasks}</span></div>
              <div>Failed: <span className="text-red-400">{stats.failedTasks}</span></div>
              <div className="col-span-2">
                Avg Time: <span className="text-green-200">
                  {stats.averageTaskTime > 0 ? `${Math.round(stats.averageTaskTime / 1000)}s` : 'N/A'}
                </span>
              </div>
              <div className="col-span-2">
                Last Activity: <span className="text-green-200">
                  {stats.mostRecentActivity > 0 ? formatTimestamp(stats.mostRecentActivity) : 'None'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Task Memory Entries */}
        {showMemories && (
          <div className="border border-green-700 rounded p-3">
            <h3 className="font-semibold text-green-300 mb-2">
              Task Memory ({selectedAgent}) - {agentMemories.length} entries
            </h3>
            
            {agentMemories.length === 0 ? (
              <div className="text-gray-500 text-xs">No memory entries for this agent</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto">
                {agentMemories.map((memory) => (
                  <div key={memory.id} className="border-l-2 border-green-600 pl-3">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-green-200 font-medium text-xs flex items-center gap-1">
                        {getTypeIcon(memory.type)} {memory.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={getStatusColor(memory.status)}>
                          {memory.status}
                        </span>
                        <span className="text-gray-400">
                          {formatTimestamp(memory.createdAt)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-300 whitespace-pre-wrap mb-2">
                      {memory.content.slice(0, 300)}
                      {memory.content.length > 300 && '...'}
                    </div>
                    
                    {memory.metadata && (
                      <div className="text-xs text-gray-500 space-y-1">
                        {memory.metadata.filePath && (
                          <div>📁 {memory.metadata.filePath}</div>
                        )}
                        {memory.metadata.tags && memory.metadata.tags.length > 0 && (
                          <div>🏷️ {memory.metadata.tags.join(', ')}</div>
                        )}
                        {memory.metadata.confidence && (
                          <div>🎯 Confidence: {Math.round(memory.metadata.confidence * 100)}%</div>
                        )}
                      </div>
                    )}
                    
                    <hr className="border-green-800 mt-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}