import React, { useState, useEffect } from 'react';
import { useMessageBus, AgentMessage, MessageFilter } from '../../stores/messageBus';

export function MessageBusViewer() {
  const { 
    messages, 
    getRecentMessages, 
    getMessagesByFilter,
    searchMessages,
    clearMessages,
    getActiveAgents,
    getMessageStats
  } = useMessageBus();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSender, setSelectedSender] = useState<string>('all');
  const [selectedReceiver, setSelectedReceiver] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<AgentMessage['type'] | 'all'>('all');
  const [showStats, setShowStats] = useState(false);
  const [maxDisplay, setMaxDisplay] = useState(50);

  const filteredMessages = React.useMemo(() => {
    let filtered = messages;
    
    // Apply search
    if (searchQuery.trim()) {
      filtered = searchMessages(searchQuery);
    }
    
    // Apply filters
    const filter: MessageFilter = {};
    if (selectedSender !== 'all') filter.sender = selectedSender;
    if (selectedReceiver !== 'all') filter.receiver = selectedReceiver;
    if (selectedType !== 'all') filter.type = selectedType;
    
    if (Object.keys(filter).length > 0) {
      filtered = getMessagesByFilter(filter);
    }
    
    return filtered.slice(-maxDisplay).reverse();
  }, [messages, searchQuery, selectedSender, selectedReceiver, selectedType, maxDisplay, searchMessages, getMessagesByFilter]);

  const stats = React.useMemo(() => getMessageStats(), [getMessageStats]);
  const activeAgents = React.useMemo(() => getActiveAgents(), [getActiveAgents]);

  const getTypeIcon = (type: AgentMessage['type']) => {
    switch (type) {
      case 'task': return '📋';
      case 'file_update': return '📝';
      case 'context': return '🧠';
      case 'log': return '📄';
      case 'completion': return '✅';
      case 'error': return '❌';
      case 'request': return '❓';
      case 'response': return '💬';
      default: return '📨';
    }
  };

  const getTypeColor = (type: AgentMessage['type']) => {
    switch (type) {
      case 'task': return 'bg-blue-900 text-blue-200';
      case 'file_update': return 'bg-purple-900 text-purple-200';
      case 'context': return 'bg-indigo-900 text-indigo-200';
      case 'log': return 'bg-gray-900 text-gray-200';
      case 'completion': return 'bg-green-900 text-green-200';
      case 'error': return 'bg-red-900 text-red-200';
      case 'request': return 'bg-yellow-900 text-yellow-200';
      case 'response': return 'bg-cyan-900 text-cyan-200';
      default: return 'bg-gray-900 text-gray-200';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const uniqueSenders = [...new Set(messages.map(m => m.sender))];
  const uniqueReceivers = [...new Set(messages.map(m => m.receiver))];
  const uniqueTypes = [...new Set(messages.map(m => m.type))];

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">📡 Message Bus</h3>
            <p className="text-sm text-gray-400">
              {messages.length} total • {filteredMessages.length} shown • {activeAgents.length} active agents
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              📊 Stats
            </button>
            <button
              onClick={clearMessages}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 mb-3"
        />

        {/* Filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Senders</option>
            {uniqueSenders.map(sender => (
              <option key={sender} value={sender}>{sender}</option>
            ))}
          </select>
          
          <select
            value={selectedReceiver}
            onChange={(e) => setSelectedReceiver(e.target.value)}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Receivers</option>
            {uniqueReceivers.map(receiver => (
              <option key={receiver} value={receiver}>{receiver}</option>
            ))}
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AgentMessage['type'] | 'all')}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {getTypeIcon(type)} {type.toUpperCase()}
              </option>
            ))}
          </select>
          
          <select
            value={maxDisplay}
            onChange={(e) => setMaxDisplay(Number(e.target.value))}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value={25}>25 msgs</option>
            <option value={50}>50 msgs</option>
            <option value={100}>100 msgs</option>
            <option value={200}>200 msgs</option>
          </select>
        </div>

        {/* Active Agents */}
        {activeAgents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeAgents.map(agent => (
              <span key={agent} className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">
                🟢 {agent}
              </span>
            ))}
          </div>
        )}

        {/* Stats Panel */}
        {showStats && (
          <div className="mt-3 p-3 bg-gray-700 rounded text-xs">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium mb-1">By Type</h4>
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span>{getTypeIcon(type as AgentMessage['type'])} {type}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium mb-1">Top Senders</h4>
                {Object.entries(stats.bySender).slice(0, 5).map(([sender, count]) => (
                  <div key={sender} className="flex justify-between">
                    <span>{sender}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium mb-1">Top Receivers</h4>
                {Object.entries(stats.byReceiver).slice(0, 5).map(([receiver, count]) => (
                  <div key={receiver} className="flex justify-between">
                    <span>{receiver}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">📡</div>
            <p className="text-lg font-medium mb-2">
              {searchQuery || selectedSender !== 'all' || selectedReceiver !== 'all' || selectedType !== 'all'
                ? 'No matching messages'
                : 'No messages yet'
              }
            </p>
            <p className="text-sm">
              {searchQuery || selectedSender !== 'all' || selectedReceiver !== 'all' || selectedType !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Agent communication will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`border-l-4 ${getPriorityColor(message.priority)} bg-gray-800 rounded-r-lg p-3 hover:bg-gray-750 transition-colors`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${getTypeColor(message.type)}`}>
                      {getTypeIcon(message.type)} {message.type}
                    </span>
                    <span className="text-xs text-blue-400 font-mono">{message.sender}</span>
                    <span className="text-xs text-gray-500">→</span>
                    <span className="text-xs text-green-400 font-mono">{message.receiver}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {message.priority && message.priority !== 'medium' && (
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        message.priority === 'high' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'
                      }`}>
                        {message.priority}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-200 mb-2 leading-relaxed">
                  {message.content}
                </p>

                {/* Metadata */}
                {message.metadata && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {message.metadata.filePath && (
                      <span className="px-2 py-1 bg-gray-700 rounded font-mono">
                        📁 {message.metadata.filePath}
                      </span>
                    )}
                    {message.metadata.taskId && (
                      <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded">
                        🔗 {message.metadata.taskId}
                      </span>
                    )}
                    {message.metadata.tags?.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-purple-900 text-purple-200 rounded">
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