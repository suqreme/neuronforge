import React, { useState } from 'react';
import { useMemoryStore, MemoryEntry } from '../../stores/memoryStore';

export function ClaudeMemoryPanel() {
  const { 
    entries, 
    clearMemory, 
    removeMemory, 
    getMemoryByType, 
    searchMemory,
    getMemoryCount,
    maxEntries,
    setMaxEntries
  } = useMemoryStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryEntry['type'] | 'all'>('all');
  const [showSettings, setShowSettings] = useState(false);

  const getTypeIcon = (type: MemoryEntry['type']) => {
    switch (type) {
      case 'user_request': return '👤';
      case 'claude_response': return '🤖';
      case 'file_action': return '📝';
      case 'project_update': return '🏗️';
      default: return '💭';
    }
  };

  const getTypeColor = (type: MemoryEntry['type']) => {
    switch (type) {
      case 'user_request': return 'bg-blue-900 text-blue-200';
      case 'claude_response': return 'bg-green-900 text-green-200';
      case 'file_action': return 'bg-purple-900 text-purple-200';
      case 'project_update': return 'bg-orange-900 text-orange-200';
      default: return 'bg-gray-900 text-gray-200';
    }
  };

  const getImportanceColor = (importance?: string) => {
    switch (importance) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-gray-500';
      default: return 'border-l-gray-600';
    }
  };

  const filteredEntries = React.useMemo(() => {
    let filtered = entries;
    
    if (selectedType !== 'all') {
      filtered = getMemoryByType(selectedType);
    }
    
    if (searchQuery.trim()) {
      filtered = searchMemory(searchQuery);
    }
    
    return filtered.slice().reverse(); // Most recent first
  }, [entries, selectedType, searchQuery, getMemoryByType, searchMemory]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const uniqueTypes = [...new Set(entries.map(e => e.type))];

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">🧠 Claude Memory</h3>
            <p className="text-sm text-gray-400">
              {getMemoryCount()} memories • {filteredEntries.length} shown
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={clearMemory}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
              title="Clear All Memory"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search memory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 mb-3"
        />

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as MemoryEntry['type'] | 'all')}
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(type => (
            <option key={type} value={type}>
              {getTypeIcon(type)} {type.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </select>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 p-3 bg-gray-700 rounded">
            <label className="block text-sm font-medium mb-2">
              Max Memory Entries: {maxEntries}
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="25"
              value={maxEntries}
              onChange={(e) => setMaxEntries(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>50</span>
              <span>500</span>
            </div>
          </div>
        )}
      </div>

      {/* Memory Entries */}
      <div className="flex-1 overflow-auto p-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-lg font-medium mb-2">
              {searchQuery || selectedType !== 'all' ? 'No matching memories' : 'No memories yet'}
            </p>
            <p className="text-sm">
              {searchQuery || selectedType !== 'all' 
                ? 'Try adjusting your search or filter' 
                : 'Claude will remember important interactions and decisions here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`border-l-4 ${getImportanceColor(entry.metadata?.importance)} bg-gray-800 rounded-r-lg p-3 hover:bg-gray-750 transition-colors`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${getTypeColor(entry.type)}`}>
                      {getTypeIcon(entry.type)} {entry.type.replace('_', ' ')}
                    </span>
                    {entry.metadata?.importance && entry.metadata.importance !== 'medium' && (
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        entry.metadata.importance === 'high' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'
                      }`}>
                        {entry.metadata.importance}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <button
                      onClick={() => removeMemory(entry.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                      title="Remove this memory"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-200 mb-2 leading-relaxed">
                  {entry.content}
                </p>

                {/* Metadata */}
                {(entry.metadata?.filePath || entry.metadata?.tags?.length) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {entry.metadata.filePath && (
                      <span className="px-2 py-1 bg-gray-700 rounded font-mono">
                        📁 {entry.metadata.filePath}
                      </span>
                    )}
                    {entry.metadata.tags?.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-900 text-blue-200 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}