import React, { useState, useEffect } from 'react';
import { useAgentMemoryStore, AgentMemoryEntry } from '../../stores/agentMemoryStore';

interface MemoryPanelProps {
  agentId: string;
}

export function MemoryPanel({ agentId }: MemoryPanelProps) {
  const { getMemory, searchMemory, clearMemory } = useAgentMemoryStore();
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(-1);

  useEffect(() => {
    const allEntries = getMemory(agentId);
    const filteredEntries = searchQuery 
      ? searchMemory(agentId, searchQuery)
      : allEntries;
    
    const typeFilteredEntries = selectedTypes.size > 0
      ? filteredEntries.filter(entry => selectedTypes.has(entry.type))
      : filteredEntries;
    
    setEntries(typeFilteredEntries);
  }, [agentId, searchQuery, selectedTypes, getMemory, searchMemory]);

  const typeColors = {
    file_generation: 'bg-green-100 text-green-800 border-green-200',
    file_update: 'bg-blue-100 text-blue-800 border-blue-200',
    task_assignment: 'bg-purple-100 text-purple-800 border-purple-200',
    completion: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    log_event: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const typeIcons = {
    file_generation: '📝',
    file_update: '✏️',
    task_assignment: '📋',
    completion: '✅',
    error: '❌',
    log_event: '📋'
  };

  const uniqueTypes = [...new Set(entries.map(entry => entry.type))];

  const toggleTypeFilter = (type: string) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const handleReplay = async () => {
    if (entries.length === 0) return;
    
    setIsReplaying(true);
    setReplayIndex(0);
    
    for (let i = 0; i < entries.length; i++) {
      setReplayIndex(i);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      // Simulate the action being replayed
      const entry = entries[i];
      console.log(`🔁 Replaying: ${entry.type} - ${entry.message || entry.file}`);
    }
    
    setIsReplaying(false);
    setReplayIndex(-1);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };

  const clearAgentMemory = () => {
    if (confirm(`Clear all memory for agent "${agentId}"?`)) {
      clearMemory(agentId);
      setEntries([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">🧠 Agent Memory</h3>
          <div className="flex gap-2">
            <button
              onClick={handleReplay}
              disabled={entries.length === 0 || isReplaying}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isReplaying ? '🔄 Replaying...' : '🔁 Replay'}
            </button>
            <button
              onClick={clearAgentMemory}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-400 mb-3">
          Agent: <span className="text-blue-400 font-mono">{agentId}</span> | 
          Entries: <span className="text-green-400">{entries.length}</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search memory entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
        />

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {uniqueTypes.map(type => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                selectedTypes.has(type) 
                  ? typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800 border-gray-200'
                  : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'
              }`}
            >
              {typeIcons[type as keyof typeof typeIcons] || '📄'} {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Timeline */}
      <div className="flex-1 overflow-auto p-4">
        {entries.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">🧠</div>
            <p>No memory entries found</p>
            <p className="text-sm mt-2">
              {searchQuery ? 'Try adjusting your search' : 'Agent hasn\'t performed any tracked actions yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`border rounded-lg p-3 transition-all ${
                  isReplaying && index === replayIndex
                    ? 'bg-yellow-900 border-yellow-500 shadow-lg'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                {/* Entry Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {typeIcons[entry.type as keyof typeof typeIcons] || '📄'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded border ${
                      typeColors[entry.type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}>
                      {entry.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                {/* Entry Content */}
                <div className="space-y-2">
                  {entry.file && (
                    <div className="text-sm">
                      <span className="text-gray-400">File:</span>{' '}
                      <span className="font-mono text-blue-400">{entry.file}</span>
                    </div>
                  )}
                  
                  {entry.message && (
                    <div className="text-sm text-gray-300">
                      {entry.message}
                    </div>
                  )}

                  {entry.task && (
                    <div className="text-sm">
                      <span className="text-gray-400">Task:</span>{' '}
                      <span className="text-green-400">{entry.task}</span>
                    </div>
                  )}

                  {entry.content && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-400 hover:text-white">
                        Show content ({entry.content.length} chars)
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-900 rounded border border-gray-700 text-gray-300 overflow-x-auto">
                        {entry.content}
                      </pre>
                    </details>
                  )}

                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-400 hover:text-white">
                        Metadata
                      </summary>
                      <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
                        {Object.entries(entry.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-400">{key}:</span>
                            <span className="text-gray-300 font-mono">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}