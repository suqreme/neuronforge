import React, { useEffect, useRef } from 'react';
import { useFileContext, FileChangeEvent } from '../../stores/fileContextStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../../stores/messageBus';

export function FileContextWatcher() {
  const { 
    getRecentChanges, 
    getSubscribedAgents,
    getChangeHistory 
  } = useFileContext();
  
  const { sendMessage } = useMessageBus();
  const lastChangeTimestamp = useRef<number>(0);

  // Watch for file changes and notify subscribed agents
  useEffect(() => {
    const interval = setInterval(() => {
      const recentChanges = getRecentChanges(10);
      const subscribedAgents = getSubscribedAgents();
      
      if (subscribedAgents.length === 0) return;
      
      // Find changes newer than our last check
      const newChanges = recentChanges.filter(
        change => change.timestamp > lastChangeTimestamp.current
      );
      
      if (newChanges.length === 0) return;
      
      // Update our last seen timestamp
      lastChangeTimestamp.current = Math.max(
        ...newChanges.map(change => change.timestamp)
      );
      
      // Notify each subscribed agent about the changes
      newChanges.forEach(change => {
        subscribedAgents.forEach(agentId => {
          // Don't notify the agent that made the change
          if (change.changedBy === agentId) return;
          
          const changeMessage = formatChangeMessage(change);
          
          sendMessage({
            sender: "FILE_CONTEXT_WATCHER",
            receiver: agentId,
            type: "file_update",
            content: changeMessage,
            priority: "medium",
            metadata: {
              filePath: change.file.path,
              changeType: change.type,
              changedBy: change.changedBy,
              fileSize: change.file.size,
              lineCount: change.file.lineCount,
              language: change.file.language,
              tags: ["file-change-notification", "reactive-update"]
            }
          });
        });
      });
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [getRecentChanges, getSubscribedAgents, sendMessage]);

  // Initial subscription notification
  useEffect(() => {
    const subscribedAgents = getSubscribedAgents();
    const totalFiles = Object.keys(useFileContext.getState().files).length;
    
    subscribedAgents.forEach(agentId => {
      sendMessage(MessagePatterns.log(
        'FILE_CONTEXT_WATCHER',
        `Agent ${agentId} subscribed to file context. Monitoring ${totalFiles} files for changes.`,
        ['file-context', 'subscription', 'monitoring']
      ));
    });
  }, []); // Only run on mount

  return null; // This is an invisible watcher component
}

function formatChangeMessage(change: FileChangeEvent): string {
  const { type, file, changedBy } = change;
  const fileName = file.path.split('/').pop() || file.path;
  
  switch (type) {
    case 'created':
      return `New file created: ${fileName} by ${changedBy} (${file.lineCount} lines, ${file.language})`;
    case 'updated':
      return `File updated: ${fileName} by ${changedBy} (${file.lineCount} lines)`;
    case 'deleted':
      return `File deleted: ${fileName} by ${changedBy}`;
    default:
      return `File changed: ${fileName} by ${changedBy}`;
  }
}