import React, { useState } from 'react';
import { 
  useFileContext, 
  useRecentFileChanges, 
  useFilesByAgent 
} from '../../stores/fileContextStore';

export function FileContextPanel() {
  const { 
    getAllFiles, 
    getSubscribedAgents, 
    getFileStats,
    getRecentChanges,
    clearFiles,
    subscribeAgent,
    unsubscribeAgent
  } = useFileContext();
  
  const [selectedView, setSelectedView] = useState<'files' | 'changes' | 'agents' | 'stats'>('files');
  const [newAgentId, setNewAgentId] = useState('');
  
  const allFiles = getAllFiles();
  const subscribedAgents = getSubscribedAgents();
  const recentChanges = getRecentChanges(20);
  const stats = getFileStats();
  
  const handleSubscribeAgent = () => {
    if (newAgentId.trim()) {
      subscribeAgent(newAgentId.trim());
      setNewAgentId('');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">📁 File Context</h3>
            <p className="text-sm text-gray-400">
              {Object.keys(allFiles).length} files • {subscribedAgents.length} subscribed agents
            </p>
          </div>
          
          <button
            onClick={clearFiles}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            🗑️ Clear
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'files', label: '📄 Files', count: Object.keys(allFiles).length },
            { key: 'changes', label: '📝 Changes', count: recentChanges.length },
            { key: 'agents', label: '🤖 Agents', count: subscribedAgents.length },
            { key: 'stats', label: '📊 Stats' }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSelectedView(key as any)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                selectedView === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {label} {count !== undefined && `(${count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {selectedView === 'files' && (
          <div className="space-y-2">
            {Object.keys(allFiles).length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-4">📁</div>
                <p className="text-lg font-medium mb-2">No files tracked</p>
                <p className="text-sm">Files will appear here when edited or created</p>
              </div>
            ) : (
              Object.values(allFiles)
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((file) => (
                  <div
                    key={file.path}
                    className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-mono text-sm">{file.path}</span>
                        {file.metadata?.hasUnsavedChanges && (
                          <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
                            Unsaved
                          </span>
                        )}
                        {file.metadata?.isNew && (
                          <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(file.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>🔤 {file.language}</span>
                      <span>📏 {file.lineCount} lines</span>
                      <span>📦 {formatFileSize(file.size)}</span>
                      <span>👤 {file.lastUpdatedBy}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {selectedView === 'changes' && (
          <div className="space-y-2">
            {recentChanges.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-lg font-medium mb-2">No changes yet</p>
                <p className="text-sm">File changes will appear here</p>
              </div>
            ) : (
              recentChanges.map((change, index) => (
                <div
                  key={`${change.file.path}-${change.timestamp}-${index}`}
                  className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        change.type === 'created' ? 'bg-green-900 text-green-200' :
                        change.type === 'updated' ? 'bg-blue-900 text-blue-200' :
                        'bg-red-900 text-red-200'
                      }`}>
                        {change.type.toUpperCase()}
                      </span>
                      <span className="text-blue-400 font-mono text-sm">{change.file.path}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(change.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>👤 {change.changedBy}</span>
                    <span>📏 {change.file.lineCount} lines</span>
                    <span>🔤 {change.file.language}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedView === 'agents' && (
          <div className="space-y-4">
            {/* Subscribe New Agent */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Subscribe New Agent</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder="Enter agent ID..."
                  className="flex-1 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSubscribeAgent}
                  disabled={!newAgentId.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
                >
                  Subscribe
                </button>
              </div>
            </div>

            {/* Subscribed Agents */}
            <div>
              <h4 className="text-sm font-medium mb-3">Subscribed Agents ({subscribedAgents.length})</h4>
              {subscribedAgents.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <div className="text-4xl mb-4">🤖</div>
                  <p className="text-lg font-medium mb-2">No subscribed agents</p>
                  <p className="text-sm">Subscribe agents to receive file change notifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subscribedAgents.map((agentId) => (
                    <div
                      key={agentId}
                      className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">
                          🟢 ACTIVE
                        </span>
                        <span className="font-mono text-sm">{agentId}</span>
                      </div>
                      
                      <button
                        onClick={() => unsubscribeAgent(agentId)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
                      >
                        Unsubscribe
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedView === 'stats' && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.totalFiles}</div>
                <div className="text-sm text-gray-400">Total Files</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.totalLines}</div>
                <div className="text-sm text-gray-400">Total Lines</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{formatFileSize(stats.totalSize)}</div>
                <div className="text-sm text-gray-400">Total Size</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{subscribedAgents.length}</div>
                <div className="text-sm text-gray-400">Subscribed Agents</div>
              </div>
            </div>

            {/* Language Breakdown */}
            {Object.keys(stats.languageBreakdown).length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3">Languages</h4>
                <div className="space-y-2">
                  {Object.entries(stats.languageBreakdown)
                    .sort(([,a], [,b]) => b - a)
                    .map(([language, count]) => (
                      <div key={language} className="flex justify-between text-sm">
                        <span className="text-gray-300">🔤 {language}</span>
                        <span className="text-gray-400">{count} files</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Agent Contributions */}
            {Object.keys(stats.agentContributions).length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3">Agent Contributions</h4>
                <div className="space-y-2">
                  {Object.entries(stats.agentContributions)
                    .sort(([,a], [,b]) => b - a)
                    .map(([agent, count]) => (
                      <div key={agent} className="flex justify-between text-sm">
                        <span className="text-gray-300">👤 {agent}</span>
                        <span className="text-gray-400">{count} files</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}