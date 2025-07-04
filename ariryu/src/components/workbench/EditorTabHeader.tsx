import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';

const EditorTabHeader: React.FC = () => {
  const { openTabs, activePath, setActivePath, closeFile } = useEditorStore();
  const [flashingTabs, setFlashingTabs] = useState<Set<string>>(new Set());

  // Flash tab when a new file is created
  useEffect(() => {
    const newTabs = openTabs.filter(tab => !tab.isDirty);
    newTabs.forEach(tab => {
      if (!flashingTabs.has(tab.path)) {
        setFlashingTabs(prev => new Set(prev).add(tab.path));
        
        // Remove flash after 2 seconds
        setTimeout(() => {
          setFlashingTabs(prev => {
            const newSet = new Set(prev);
            newSet.delete(tab.path);
            return newSet;
          });
        }, 2000);
      }
    });
  }, [openTabs.length]); // Only trigger when number of tabs changes

  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  if (openTabs.length === 0) {
    return (
      <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3">
        <span className="text-sm text-gray-400">No files open</span>
      </div>
    );
  }

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center overflow-x-auto">
      {openTabs.map((file) => (
        <div
          key={file.path}
          className={`flex items-center min-w-0 border-r border-gray-700 transition-all duration-200 ${
            activePath === file.path
              ? 'bg-gray-700 border-b-2 border-blue-500'
              : 'hover:bg-gray-700'
          } ${
            flashingTabs.has(file.path)
              ? 'animate-pulse bg-green-700/30 border-green-400'
              : ''
          }`}
        >
          <button
            onClick={() => setActivePath(file.path)}
            className="flex items-center px-3 py-2 text-sm min-w-0 focus:outline-none"
          >
            <span
              className={`truncate ${
                activePath === file.path ? 'text-white' : 'text-gray-300'
              }`}
            >
              {getFileName(file.path)}
            </span>
            {file.isDirty && (
              <span className="ml-1 text-orange-400 text-xs">●</span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file.path);
            }}
            className="px-2 py-2 text-gray-400 hover:text-white hover:bg-gray-600 focus:outline-none"
            title="Close file"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default EditorTabHeader;