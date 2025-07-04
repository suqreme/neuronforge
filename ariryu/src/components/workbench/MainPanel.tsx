import React from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useFileContext } from '../../stores/fileContextStore';
import EditorTabHeader from './EditorTabHeader';

const MainPanel: React.FC = () => {
  const { openTabs, activePath, updateContent, openFile } = useEditorStore();
  const { project } = useProjectStore();
  const { updateFile } = useFileContext();
  
  const activeFile = openTabs.find(file => file.path === activePath);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activePath) {
      // Update editor store
      updateContent(activePath, value);
      
      // Update file context store for agent visibility
      updateFile(activePath, value, 'USER', activeFile?.language);
    }
  };

  const handleOpenSampleFile = () => {
    const sampleFile = {
      path: 'src/components/Welcome.tsx',
      content: `import React from 'react';

interface WelcomeProps {
  name?: string;
}

const Welcome: React.FC<WelcomeProps> = ({ name = 'Developer' }) => {
  return (
    <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg">
      <h1 className="text-2xl font-bold mb-4">
        Welcome to NeuronForge, {name}!
      </h1>
      <p className="text-blue-100">
        Start building amazing apps with AI-powered agents.
      </p>
    </div>
  );
};

export default Welcome;`,
      language: 'typescript',
      isDirty: false,
    };
    
    // Open in editor
    openFile(sampleFile);
    
    // Register in file context store
    updateFile(sampleFile.path, sampleFile.content, 'USER', sampleFile.language);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4">
        <h1 className="text-lg font-semibold text-white">NeuronForge</h1>
        
        {/* Agent Status Indicators */}
        <div className="ml-4 flex items-center space-x-3">
          {project?.agents.map((agent) => (
            <div key={agent.id} className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                agent.status === 'running' ? 'bg-blue-500 animate-pulse' :
                agent.status === 'completed' ? 'bg-green-500' :
                agent.status === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`}></div>
              <span className="text-xs text-gray-400">{agent.name.replace(' Agent', '')}</span>
              {agent.status === 'running' && agent.progress !== undefined && (
                <span className="text-xs text-blue-400">({agent.progress}%)</span>
              )}
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center space-x-4">
          <span className={`text-sm ${
            project?.status === 'running' ? 'text-blue-400' :
            project?.status === 'building' ? 'text-yellow-400' :
            project?.status === 'error' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {project?.status === 'running' ? 'Building...' :
             project?.status === 'building' ? 'Processing...' :
             project?.status === 'error' ? 'Error' :
             'Ready'}
          </span>
          <div className={`w-2 h-2 rounded-full ${
            project?.status === 'running' ? 'bg-blue-500 animate-pulse' :
            project?.status === 'building' ? 'bg-yellow-500 animate-pulse' :
            project?.status === 'error' ? 'bg-red-500' :
            'bg-green-500'
          }`}></div>
        </div>
      </div>

      {/* File Tabs */}
      <EditorTabHeader />

      {/* Monaco Editor */}
      <div className="flex-1 bg-gray-900">
        {activeFile ? (
          <Editor
            height="100%"
            language={activeFile.language}
            theme="vs-dark"
            value={activeFile.content}
            onChange={handleEditorChange}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl text-gray-500 mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-400 mb-2">No files open</h3>
              <p className="text-sm text-gray-500 mb-4">
                Open a file to start editing
              </p>
              <button
                onClick={handleOpenSampleFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Open Sample File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPanel;