import React, { useState } from 'react';
import { generateFileDiff, getDiffSummary, FileDiff } from '../../utils/diffUtils';

interface DiffPanelProps {
  path: string;
  oldContent: string;
  newContent: string;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export function DiffPanel({ 
  path, 
  oldContent, 
  newContent, 
  onApprove, 
  onReject,
  showActions = true 
}: DiffPanelProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const diff: FileDiff = generateFileDiff(oldContent, newContent, path);
  const summary = getDiffSummary(diff);

  const renderUnifiedView = () => (
    <div className="font-mono text-sm overflow-auto">
      {diff.lines.map((line, index) => (
        <div
          key={index}
          className={`flex hover:bg-gray-800 ${
            line.added ? 'bg-green-900/30' : 
            line.removed ? 'bg-red-900/30' : 
            'bg-gray-900'
          }`}
        >
          <div className="w-16 px-2 py-1 text-gray-500 text-right border-r border-gray-700 select-none">
            <span className="block">
              {line.oldLineNumber || ''}
            </span>
          </div>
          <div className="w-16 px-2 py-1 text-gray-500 text-right border-r border-gray-700 select-none">
            <span className="block">
              {line.newLineNumber || ''}
            </span>
          </div>
          <div className="flex-1 px-2 py-1">
            <span className={`inline-block w-4 ${
              line.added ? 'text-green-400' : 
              line.removed ? 'text-red-400' : 
              'text-gray-500'
            }`}>
              {line.added ? '+' : line.removed ? '-' : ' '}
            </span>
            <span className={`${
              line.added ? 'text-green-200' : 
              line.removed ? 'text-red-200' : 
              'text-gray-200'
            }`}>
              {line.text}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSplitView = () => {
    const oldLines = diff.lines.filter(line => !line.added);
    const newLines = diff.lines.filter(line => !line.removed);
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="flex font-mono text-sm overflow-auto">
        {/* Old Content */}
        <div className="flex-1 border-r border-gray-700">
          <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 text-sm font-medium">
            Original
          </div>
          <div>
            {Array.from({ length: maxLines }, (_, index) => {
              const line = oldLines[index];
              return (
                <div
                  key={`old-${index}`}
                  className={`flex hover:bg-gray-800 ${
                    line?.removed ? 'bg-red-900/30' : 'bg-gray-900'
                  }`}
                >
                  <div className="w-12 px-2 py-1 text-gray-500 text-right border-r border-gray-700 select-none">
                    {line?.oldLineNumber || ''}
                  </div>
                  <div className="flex-1 px-2 py-1">
                    <span className={line?.removed ? 'text-red-200' : 'text-gray-200'}>
                      {line?.text || ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* New Content */}
        <div className="flex-1">
          <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 text-sm font-medium">
            Updated
          </div>
          <div>
            {Array.from({ length: maxLines }, (_, index) => {
              const line = newLines[index];
              return (
                <div
                  key={`new-${index}`}
                  className={`flex hover:bg-gray-800 ${
                    line?.added ? 'bg-green-900/30' : 'bg-gray-900'
                  }`}
                >
                  <div className="w-12 px-2 py-1 text-gray-500 text-right border-r border-gray-700 select-none">
                    {line?.newLineNumber || ''}
                  </div>
                  <div className="flex-1 px-2 py-1">
                    <span className={line?.added ? 'text-green-200' : 'text-gray-200'}>
                      {line?.text || ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">📋 File Changes</h3>
            <p className="text-sm text-gray-400 font-mono">{path}</p>
          </div>
          
          {showActions && (
            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                ❌ Reject
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                ✅ Approve
              </button>
            </div>
          )}
        </div>

        {/* Stats and View Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              {summary}
            </span>
            <span className="text-xs px-2 py-1 bg-gray-700 rounded">
              {diff.lines.length} line{diff.lines.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex bg-gray-700 rounded">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 text-sm rounded-l transition-colors ${
                viewMode === 'unified' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-sm rounded-r transition-colors ${
                viewMode === 'split' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              Split
            </button>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto">
        {diff.lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📄</div>
              <p>No differences found</p>
            </div>
          </div>
        ) : (
          viewMode === 'unified' ? renderUnifiedView() : renderSplitView()
        )}
      </div>
    </div>
  );
}