import React from 'react';
import { useDiffStore } from '../../stores/diffStore';
import { DiffPanel } from './DiffPanel';
import { writeAgentFile } from '../../utils/fileWriter';
import { useToast } from '../ui/Toast';
import { useMemoryStore } from '../../stores/memoryStore';
import { useFileContext } from '../../stores/fileContextStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../../stores/messageBus';

export function DiffModal() {
  const { 
    isModalOpen, 
    getCurrentDiff, 
    closeDiffModal, 
    removePendingDiff 
  } = useDiffStore();
  
  const { addToast } = useToast();
  const { addMemory } = useMemoryStore();
  const { sendMessage } = useMessageBus();
  const { markFileAsSaved } = useFileContext();
  const currentDiff = getCurrentDiff();

  if (!isModalOpen || !currentDiff) {
    return null;
  }

  const handleApprove = async () => {
    try {
      // Apply the changes using the file writer
      await writeAgentFile(
        currentDiff.path, 
        currentDiff.newContent, 
        undefined, 
        'claude-assistant'
      );
      
      // Send approval message to bus
      sendMessage(MessagePatterns.completion(
        AGENT_TYPES.USER,
        AGENT_TYPES.CLAUDE,
        `File changes approved and applied: ${currentDiff.path}`,
        currentDiff.id
      ));
      
      // Mark file as saved in context store
      markFileAsSaved(currentDiff.path);
      
      // Add to memory
      addMemory(
        `Applied file changes to: ${currentDiff.path}. ${currentDiff.reason || 'Changes approved and applied.'}`,
        'file_action',
        {
          filePath: currentDiff.path,
          actionType: 'approved',
          importance: 'high',
          tags: ['file-approved', 'applied-changes']
        }
      );
      
      addToast({
        message: `✅ Applied changes to ${currentDiff.path}`,
        type: 'success'
      });
      
      // Remove from pending diffs and close modal
      removePendingDiff(currentDiff.id);
      closeDiffModal();
      
    } catch (error) {
      addToast({
        message: `Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  const handleReject = () => {
    // Send rejection message to bus
    sendMessage(MessagePatterns.error(
      AGENT_TYPES.USER,
      AGENT_TYPES.CLAUDE,
      `File changes rejected: ${currentDiff.path}. ${currentDiff.reason || 'User declined the changes.'}`,
      currentDiff.id
    ));
    
    // Add to memory
    addMemory(
      `Rejected file changes to: ${currentDiff.path}. ${currentDiff.reason || 'Changes rejected by user.'}`,
      'file_action',
      {
        filePath: currentDiff.path,
        actionType: 'rejected',
        importance: 'medium',
        tags: ['file-rejected', 'user-decision']
      }
    );
    
    addToast({
      message: `❌ Rejected changes to ${currentDiff.path}`,
      type: 'info'
    });
    
    // Remove from pending diffs and close modal
    removePendingDiff(currentDiff.id);
    closeDiffModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={closeDiffModal}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl h-full max-h-[90vh] mx-4 bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Review Changes</h2>
            <p className="text-sm text-gray-400">
              Claude wants to modify: <span className="font-mono text-blue-400">{currentDiff.path}</span>
            </p>
            {currentDiff.reason && (
              <p className="text-sm text-gray-300 mt-1">
                <strong>Reason:</strong> {currentDiff.reason}
              </p>
            )}
          </div>
          
          <button
            onClick={closeDiffModal}
            className="text-gray-400 hover:text-white p-2 rounded transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Diff Panel */}
        <div className="flex-1 h-full">
          <DiffPanel
            path={currentDiff.path}
            oldContent={currentDiff.oldContent}
            newContent={currentDiff.newContent}
            onApprove={handleApprove}
            onReject={handleReject}
            showActions={true}
          />
        </div>
      </div>
    </div>
  );
}