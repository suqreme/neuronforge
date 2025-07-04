import React from 'react';
import { useLogStore } from '../../stores/logStore';

const LogViewer: React.FC = () => {
  const { logs, clearLogs } = useLogStore();

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'agent': return 'text-blue-400';
      case 'info': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  const isCriticLog = (source: string) => {
    return source.toLowerCase().includes('critic') || 
           source.toLowerCase().includes('summarizer') ||
           source.toLowerCase().includes('summary');
  };

  const isReflectionLog = (source: string) => {
    return source.toLowerCase().includes('reflection') || 
           source.toLowerCase().includes('cleanup') ||
           source.toLowerCase().includes('refactor');
  };

  const isHighPriorityCritic = (log: any) => {
    return isCriticLog(log.source) && 
           (log.message.includes('URGENT') || 
            log.message.includes('🚨') || 
            log.level === 'warn' || 
            log.level === 'error');
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'success': return '✅';
      case 'agent': return '🤖';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-3 justify-between">
        <span className="text-sm text-gray-300">Agent Logs</span>
        <button 
          onClick={clearLogs}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
        >
          Clear
        </button>
      </div>

      {/* Log Content */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-lg mb-2">📋</div>
            <p>No logs yet</p>
            <p className="text-xs mt-1">Agent activity will appear here</p>
          </div>
        ) : (
          logs.map((log) => {
            const isCritic = isCriticLog(log.source);
            const isReflection = isReflectionLog(log.source);
            const isHighPriority = isHighPriorityCritic(log);
            
            let specialClass = "border-transparent hover:border-blue-500/30";
            let iconOverride = null;
            
            if (isCritic) {
              if (isHighPriority) {
                specialClass = "bg-red-900/20 border-red-500/50 shadow-lg animate-pulse";
                iconOverride = '🚨';
              } else {
                specialClass = "bg-purple-900/20 border-purple-500/50 shadow-md";
                iconOverride = '🧠';
              }
            } else if (isReflection) {
              specialClass = "bg-teal-900/20 border-teal-500/50 shadow-md";
              iconOverride = '🧹';
            }
            
            return (
              <div key={log.id} className={`flex items-start gap-2 py-2 hover:bg-gray-800/50 border-l-2 ${specialClass} transition-colors ${(isCritic || isReflection) ? 'ml-2 rounded-r-md' : ''}`}>
                <span className="text-gray-500 text-xs min-w-[50px]">
                  {formatTime(log.timestamp)}
                </span>
                <span className="text-xs">
                  {iconOverride || getLevelIcon(log.level)}
                </span>
                <span className={`text-xs min-w-[70px] uppercase font-medium ${
                  isHighPriority ? 'text-red-300' : 
                  isCritic ? 'text-purple-300' : 
                  isReflection ? 'text-teal-300' : 'text-gray-400'
                }`}>
                  {log.source}
                </span>
                <span className={`flex-1 text-sm leading-relaxed ${
                  isHighPriority ? 'text-red-100 font-bold' :
                  isCritic ? 'text-purple-100 font-medium' : 
                  isReflection ? 'text-teal-100 font-medium' : 'text-gray-300'
                }`}>
                  {(isCritic && (log.message.includes('📊') || log.message.includes('🧠') || log.message.includes('🎯'))) || 
                   (isReflection && (log.message.includes('🧹') || log.message.includes('🔄') || log.message.includes('💡'))) ? (
                    <div className={`whitespace-pre-wrap font-mono text-xs p-2 rounded border ${
                      isHighPriority ? 'bg-red-950/30 border-red-600/30' : 
                      isCritic ? 'bg-purple-950/30 border-purple-600/30' : 'bg-teal-950/30 border-teal-600/30'
                    }`}>
                      {log.message}
                    </div>
                  ) : (
                    <span style={(isCritic || isReflection) ? {fontStyle: 'italic'} : {}}>
                      {log.message}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LogViewer;