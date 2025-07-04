import React from 'react';
import { useDiffStore } from '../../stores/diffStore';
import { getDiffSummary, generateFileDiff } from '../../utils/diffUtils';

export function PendingDiffsPanel() {
  const { 
    pendingDiffs, 
    openDiffModal, 
    removePendingDiff, 
    clearAllDiffs 
  } = useDiffStore();

  if (pendingDiffs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-lg font-medium mb-2">No Pending Changes</p>
          <p className="text-sm">
            When Claude suggests file changes, they'll appear here for review.
          </p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">📋 Pending Changes</h3>
            <p className="text-sm text-gray-400">
              {pendingDiffs.length} change{pendingDiffs.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          
          {pendingDiffs.length > 0 && (
            <button
              onClick={clearAllDiffs}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* Pending Diffs List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {pendingDiffs.map((diff) => {
          const fileDiff = generateFileDiff(diff.oldContent, diff.newContent, diff.path);
          const summary = getDiffSummary(fileDiff);
          
          return (
            <div
              key={diff.id}
              className="border border-gray-700 rounded-lg p-4 bg-gray-800 hover:bg-gray-750 transition-colors"
            >
              {/* File Path and Time */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-blue-400 text-sm">{diff.path}</span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(diff.timestamp)}
                </span>
              </div>

              {/* Reason */}
              {diff.reason && (
                <p className="text-sm text-gray-300 mb-3">
                  {diff.reason}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                  {summary}
                </span>
                <span className="text-xs text-gray-400">
                  {fileDiff.lines.length} lines affected
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openDiffModal(diff.id)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  👁️ Review Changes
                </button>
                <button
                  onClick={() => removePendingDiff(diff.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  ❌
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}